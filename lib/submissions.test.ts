import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkPhotos,
  isNaverPlaceUrl,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  submitNewPlace,
  uploadPhotos,
} from '@/lib/submissions';

/** 실제 Storage·DB를 부르지 않는다. 무엇이 오갔는지만 받아 둔다. */
const uploaded: string[] = [];
const removed: string[] = [];
/** insert에 실려 나간 행. 어떤 값이 DB로 갔는지 보려고 붙잡는다 */
const inserted: Record<string, unknown>[] = [];

/** 테스트가 그때그때 갈아끼우는 실패 스위치 */
const fail: { uploadFrom: number | null; insert: { code: string; message: string } | null } = {
  uploadFrom: null,
  insert: null,
};

vi.mock('@/lib/supabase-browser', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-uuid' } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (fail.uploadFrom !== null && uploaded.length >= fail.uploadFrom) {
            return { error: { message: '업로드 실패' } };
          }
          uploaded.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: fail.insert };
      },
    }),
  }),
}));

beforeEach(() => {
  uploaded.length = 0;
  removed.length = 0;
  inserted.length = 0;
  fail.uploadFrom = null;
  fail.insert = null;
});

/**
 * 제출 전에 걸러내는 검사만 본다. 업로드와 insert는 Supabase에 붙는 일이라
 * 여기서 검증하지 않는다 (RLS는 scripts/verify-schema.sh가 본다).
 */

/** 크기만 다른 가짜 파일. 내용은 검사하지 않으므로 채우지 않는다. */
function makeFile({ type = 'image/jpeg', size = 1024, name = 'a.jpg' } = {}): File {
  const file = new File([''], name, { type });
  // File.size는 읽기 전용이라 내용으로 만들면 5MB를 실제로 할당해야 한다.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('isNaverPlaceUrl', () => {
  it('네이버 지도·단축 링크를 받는다', () => {
    expect(isNaverPlaceUrl('https://naver.me/xAbC1234')).toBe(true);
    expect(isNaverPlaceUrl('https://map.naver.com/p/entry/place/123')).toBe(true);
    expect(isNaverPlaceUrl('https://m.place.naver.com/restaurant/123/home')).toBe(true);
  });

  it('앞뒤 공백은 문제 삼지 않는다', () => {
    expect(isNaverPlaceUrl('  https://naver.me/xAbC1234  ')).toBe(true);
  });

  it('다른 도메인은 거른다', () => {
    expect(isNaverPlaceUrl('https://example.com/a')).toBe(false);
    expect(isNaverPlaceUrl('https://map.kakao.com/1234')).toBe(false);
  });

  it('naver를 흉내 낸 도메인에 속지 않는다', () => {
    // hostname 끝을 보므로 naver.com.evil.io도, notnaver.com도 통과하면 안 된다.
    expect(isNaverPlaceUrl('https://naver.com.evil.io/place')).toBe(false);
    expect(isNaverPlaceUrl('https://notnaver.com/place')).toBe(false);
  });

  it('http와 URL이 아닌 문자열을 거른다', () => {
    expect(isNaverPlaceUrl('http://naver.me/xAbC1234')).toBe(false);
    expect(isNaverPlaceUrl('나루터')).toBe(false);
    expect(isNaverPlaceUrl('')).toBe(false);
  });
});

describe('checkPhotos', () => {
  it('없거나 규격에 맞으면 통과한다', () => {
    expect(checkPhotos([])).toBeNull();
    expect(checkPhotos([makeFile(), makeFile({ type: 'image/png' })])).toBeNull();
  });

  it('장수를 넘기면 사유를 낸다', () => {
    const files = Array.from({ length: MAX_PHOTOS + 1 }, () => makeFile());
    expect(checkPhotos(files)).toBe('사진은 5장까지 올릴 수 있어요');
  });

  it('이미지가 아니면 거른다', () => {
    // 버킷의 allowed_mime_types가 같은 것을 다시 막지만, 5MB를 다 올려보낸 뒤
    // 실패하는 대신 고르는 즉시 말해 주려는 검사다.
    expect(checkPhotos([makeFile({ type: 'application/pdf', name: 'a.pdf' })])).toBe(
      'JPG, PNG, WebP 사진만 올릴 수 있어요',
    );
  });

  it('한 장이라도 5MB를 넘으면 거른다', () => {
    const files = [makeFile(), makeFile({ size: MAX_PHOTO_BYTES + 1 })];
    expect(checkPhotos(files)).toBe('사진 한 장은 5MB까지예요');
  });
});

describe('uploadPhotos', () => {
  it('본인 폴더에 uuid 이름으로 올린다', async () => {
    await uploadPhotos([makeFile({ name: '내 사진.jpg' })]);

    // 원본 파일명을 경로로 쓰지 않는다 — 한글·공백·중복이 그대로 키가 된다.
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatch(/^submissions\/user-uuid\/[0-9a-f-]{36}\.jpg$/);
  });

  it('경로가 아니라 공개 URL을 돌려준다', async () => {
    // 제보 테이블의 photos는 URL을 담는다. 검수자가 대시보드에서 그대로 열 수
    // 있어야 하고, DB의 check 제약도 URL 모양을 요구한다.
    const [url] = await uploadPhotos([makeFile({ name: 'a.png', type: 'image/png' })]);

    expect(url).toBe(
      `http://localhost:54321/storage/v1/object/public/place-images/${uploaded[0]}`,
    );
  });

  it('사진이 없으면 아무것도 올리지 않는다', async () => {
    expect(await uploadPhotos([])).toEqual([]);
    expect(uploaded).toEqual([]);
  });

  it('규격에 걸리면 올리지 않고 사유를 던진다', async () => {
    await expect(
      uploadPhotos([makeFile({ name: 'a.pdf', type: 'application/pdf' })]),
    ).rejects.toThrow(
      'JPG, PNG, WebP 사진만 올릴 수 있어요',
    );
    expect(uploaded).toEqual([]);
  });
});

describe('제출이 실패하면 올린 사진을 되돌린다', () => {
  // 사진은 제출 버튼을 누를 때 올라가고 insert가 그 뒤에 온다. 그 사이에 실패하면
  // 아무도 가리키지 않는 파일이 버킷에 남으므로, 그 자리에서 치운다.
  // (놓친 것은 scripts/prune-orphan-photos.mjs가 나중에 걷어간다)

  it('insert가 실패하면 방금 올린 사진을 지운다', async () => {
    fail.insert = { code: '23505', message: 'duplicate key value ...' };

    await expect(
      submitNewPlace({
        naverUrl: 'https://naver.me/abc',
        files: [makeFile(), makeFile({ name: 'b.png', type: 'image/png' })],
        note: '',
      }),
    ).rejects.toThrow('이미 검토를 기다리는 요청이 있어요');

    expect(uploaded).toHaveLength(2);
    expect(removed).toEqual(uploaded);
  });

  it('업로드 도중 실패하면 앞서 올린 장을 되돌린다', async () => {
    fail.uploadFrom = 1; // 두 번째 장부터 실패

    await expect(
      submitNewPlace({
        naverUrl: 'https://naver.me/abc',
        files: [makeFile(), makeFile({ name: 'b.jpg' })],
        note: '',
      }),
    ).rejects.toThrow('사진을 올리지 못했습니다');

    expect(uploaded).toHaveLength(1);
    expect(removed).toEqual(uploaded);
  });

  it('성공하면 아무것도 지우지 않는다', async () => {
    await submitNewPlace({
      naverUrl: 'https://naver.me/abc',
      files: [makeFile()],
      note: '좋아요',
    });

    expect(uploaded).toHaveLength(1);
    expect(removed).toEqual([]);
  });

  it('네이버 링크가 아니면 업로드조차 하지 않는다', async () => {
    await expect(
      submitNewPlace({ naverUrl: 'https://example.com/a', files: [makeFile()], note: '' }),
    ).rejects.toThrow('네이버 지도 링크를 넣어주세요');

    expect(uploaded).toEqual([]);
  });
});


/**
 * 가게 이름은 2026-08-21에 붙었다. **선택 입력이고 빈 값은 null로 간다** —
 * DB의 check가 공백만 든 값을 거부하므로 빈 문자열을 그대로 보내면 insert가 깨진다.
 */
describe('submitNewPlace — 가게 이름', () => {
  it('적은 이름을 그대로 싣는다', async () => {
    await submitNewPlace({
      naverUrl: 'https://naver.me/abc',
      placeName: '나루터',
      files: [],
      note: '',
    });
    expect(inserted[0].place_name).toBe('나루터');
  });

  it('앞뒤 공백을 턴다', async () => {
    await submitNewPlace({
      naverUrl: 'https://naver.me/abc',
      placeName: '  나루터 ',
      files: [],
      note: '',
    });
    expect(inserted[0].place_name).toBe('나루터');
  });

  it('공백만 넣으면 null이다', async () => {
    await submitNewPlace({
      naverUrl: 'https://naver.me/abc',
      placeName: '   ',
      files: [],
      note: '',
    });
    expect(inserted[0].place_name).toBeNull();
  });

  it('아예 넘기지 않아도 된다 (선택 입력)', async () => {
    await submitNewPlace({ naverUrl: 'https://naver.me/abc', files: [], note: '' });
    expect(inserted[0].place_name).toBeNull();
  });
});
