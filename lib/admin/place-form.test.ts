import { describe, expect, it } from 'vitest';
import {
  buildPlacePayload,
  deletablePaths,
  EMPTY_PLACE_FORM,
  isSubmissionPath,
  missingForPublished,
  parseTags,
  remainingPaths,
  removeSlot,
  replaceSlot,
  validatePlaceForm,
  type PhotoSlot,
  type PlaceFormValues,
} from '@/lib/admin/place-form';

/** 검증을 통과하는 최소한의 폼. 각 테스트는 자기가 보는 값만 덮어쓴다 */
function makeForm(overrides: Partial<PlaceFormValues> = {}): PlaceFormValues {
  return {
    ...EMPTY_PLACE_FORM,
    name: '나루터',
    address: '서울 송파구 백제고분로 000',
    lat: '37.5078',
    lng: '127.1072',
    open_time: '09:00',
    close_time: '22:00',
    ...overrides,
  };
}

describe('validatePlaceForm', () => {
  it('최소한의 값이 있으면 통과한다', () => {
    expect(validatePlaceForm(makeForm())).toEqual([]);
  });

  it('이름과 주소가 비면 각각 잡는다', () => {
    const errors = validatePlaceForm(makeForm({ name: '  ', address: '' }));
    expect(errors).toHaveLength(2);
  });

  it('좌표가 비면 지도에서 찍으라고 한다', () => {
    expect(validatePlaceForm(makeForm({ lat: '', lng: '' }))).toContain(
      '지도에서 위치를 찍어주세요',
    );
  });

  it('위도와 경도를 바꿔 넣으면 범위에서 걸린다', () => {
    // 127.1072는 위도 범위(33~39) 밖이다. 실수로 가장 흔한 모양이다.
    const errors = validatePlaceForm(makeForm({ lat: '127.1072', lng: '37.5078' }));
    expect(errors.some((message) => message.includes('국내 범위'))).toBe(true);
  });

  it('24시간 영업이 아니면 영업시간이 있어야 한다', () => {
    const errors = validatePlaceForm(makeForm({ open_time: '', close_time: '' }));
    expect(errors.some((message) => message.includes('영업시간'))).toBe(true);
  });

  it('24시간 영업이면 영업시간이 비어도 통과한다', () => {
    expect(validatePlaceForm(makeForm({ is_24h: true, open_time: '', close_time: '' }))).toEqual([]);
  });

  it('영업시간 형식이 틀리면 잡는다', () => {
    expect(validatePlaceForm(makeForm({ open_time: '9시' }))).toContain(
      '영업시간은 HH:mm 형식이어야 해요',
    );
  });

  it('가격이 숫자가 아니면 잡는다', () => {
    expect(validatePlaceForm(makeForm({ iced_americano_price: '4,500' }))).toHaveLength(1);
  });

  it('가격이 비어 있는 것은 정상이다', () => {
    expect(validatePlaceForm(makeForm({ iced_americano_price: '' }))).toEqual([]);
  });

  it('네이버 링크가 https가 아니면 잡는다', () => {
    expect(validatePlaceForm(makeForm({ naver_place_url: 'naver.me/abc' }))).toHaveLength(1);
  });

  /**
   * ★ AC14 — 제약 이름이 아니라 무엇이 비었는지를 말해야 한다.
   * DB의 places_published_requires_core가 같은 것을 막지만 거기까지 보내면
   * 사용자가 보는 것은 Postgres 오류 문자열이다.
   */
  it('공개하려면 핵심 다섯이 채워져 있어야 하고, 비어 있는 것을 이름으로 말한다', () => {
    const errors = validatePlaceForm(makeForm({ status: 'published' }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('공개하려면 콘센트 · 와이파이 · 소음 · 작업 적합도 · 확인일을(를) 채워야 해요');
  });

  it('공개가 아니면 핵심 다섯이 비어도 통과한다', () => {
    expect(validatePlaceForm(makeForm({ status: 'draft' }))).toEqual([]);
  });

  it('핵심 다섯이 다 차 있으면 공개할 수 있다', () => {
    const form = makeForm({
      status: 'published',
      outlet: 'many',
      wifi: 'true',
      noise: 'quiet',
      work_fit: 'good',
      last_verified: '2026-08-21',
    });
    expect(validatePlaceForm(form)).toEqual([]);
  });

  /** wifi=false는 "없음"이지 "모름"이 아니다. 빈 문자열과 구분되어야 한다 */
  it('와이파이가 없음(false)이어도 공개를 막지 않는다', () => {
    const form = makeForm({
      status: 'published',
      outlet: 'many',
      wifi: 'false',
      noise: 'quiet',
      work_fit: 'good',
      last_verified: '2026-08-21',
    });
    expect(missingForPublished(form)).toEqual([]);
  });
});

describe('buildPlacePayload', () => {
  it('빈 문자열은 전부 null이 된다', () => {
    const payload = buildPlacePayload(makeForm());
    expect(payload.slug).toBeNull();
    expect(payload.district).toBeNull();
    expect(payload.naver_place_url).toBeNull();
    expect(payload.iced_americano_price).toBeNull();
    expect(payload.outlet).toBeNull();
    expect(payload.noise).toBeNull();
    expect(payload.work_fit).toBeNull();
    expect(payload.last_verified).toBeNull();
  });

  /** 도입은 결정됐지만 값은 9곳 전부 null이다. 추측으로 채우지 않는다 */
  it('work_policy를 비워 둘 수 있다', () => {
    expect(buildPlacePayload(makeForm()).work_policy).toBeNull();
  });

  it('와이파이는 세 상태를 구분한다', () => {
    expect(buildPlacePayload(makeForm({ wifi: '' })).wifi).toBeNull();
    expect(buildPlacePayload(makeForm({ wifi: 'true' })).wifi).toBe(true);
    expect(buildPlacePayload(makeForm({ wifi: 'false' })).wifi).toBe(false);
  });

  it('가격 0을 null로 만들지 않는다', () => {
    expect(buildPlacePayload(makeForm({ iced_americano_price: '0' })).iced_americano_price).toBe(0);
  });

  /**
   * 24시간 영업이면 시간을 비운다. DB 제약은 값이 남아 있어도 통과시키지만,
   * 남겨 두면 상세가 "24시간 영업 · 09:00-18:00"을 그린다.
   */
  it('24시간 영업이면 영업시간을 지운다', () => {
    const payload = buildPlacePayload(makeForm({ is_24h: true, open_time: '09:00', close_time: '18:00' }));
    expect(payload.open_time).toBeNull();
    expect(payload.close_time).toBeNull();
  });

  /** places.open_time은 정규식 check가 걸린 text 컬럼이라 초가 붙으면 거부된다 */
  it('HH:mm:ss로 들어오면 초를 잘라낸다', () => {
    const payload = buildPlacePayload(makeForm({ open_time: '09:00:00', close_time: '22:30:00' }));
    expect(payload.open_time).toBe('09:00');
    expect(payload.close_time).toBe('22:30');
  });

  it('좌표를 숫자로 바꾼다', () => {
    const payload = buildPlacePayload(makeForm());
    expect(payload.lat).toBe(37.5078);
    expect(payload.lng).toBe(127.1072);
  });

  it('이름과 주소의 앞뒤 공백을 턴다', () => {
    const payload = buildPlacePayload(makeForm({ name: '  나루터 ', address: ' 서울 송파구 ' }));
    expect(payload.name).toBe('나루터');
    expect(payload.address).toBe('서울 송파구');
  });
});

describe('parseTags', () => {
  it('쉼표로 나누고 공백을 턴다', () => {
    expect(parseTags('평일, 콘센트 ,조용함')).toEqual(['평일', '콘센트', '조용함']);
  });

  it('빈 항목과 중복을 걷어낸다', () => {
    expect(parseTags('평일,,평일, ')).toEqual(['평일']);
  });

  it('빈 문자열은 빈 배열이다', () => {
    expect(parseTags('   ')).toEqual([]);
  });
});

describe('사진 경로', () => {
  it('검수 폴더 경로를 알아본다', () => {
    expect(isSubmissionPath('submissions/abc-def/1.jpg')).toBe(true);
    expect(isSubmissionPath('naruteo/1.jpg')).toBe(false);
  });

  /**
   * ★ AC16 — 뺀 사진 중 storage에서도 지울 것은 `<slug>/` 아래뿐이다.
   * `submissions/` 아래는 제보 row가 여전히 가리키므로 파일을 남긴다.
   */
  it('검수 폴더 사진은 지울 목록에 넣지 않는다', () => {
    const original = ['naruteo/a.jpg', 'submissions/uid/b.jpg', 'naruteo/c.jpg'];
    expect(deletablePaths(original, ['naruteo/c.jpg'])).toEqual(['naruteo/a.jpg']);
  });

  it('남아 있는 사진은 지우지 않는다', () => {
    const original = ['naruteo/a.jpg', 'naruteo/b.jpg'];
    expect(deletablePaths(original, original)).toEqual([]);
  });
});

describe('사진 슬롯', () => {
  const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

  const existing = (path: string): PhotoSlot => ({ kind: 'existing', path, url: `https://x/${path}` });

  const slots: PhotoSlot[] = [existing('naruteo/a.jpg'), existing('naruteo/b.jpg'), existing('naruteo/c.jpg')];

  /** 첫 장이 마커 썸네일이라 순서가 의미를 갖는다 */
  it('교체해도 자리가 유지된다', () => {
    const next = replaceSlot(slots, 1, file('new.jpg'), 'k1');
    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(existing('naruteo/a.jpg'));
    expect(next[1].kind).toBe('new');
    expect(next[2]).toEqual(existing('naruteo/c.jpg'));
  });

  it('교체하면 그 경로가 남은 목록에서 빠진다', () => {
    const next = replaceSlot(slots, 1, file('new.jpg'), 'k1');
    expect(remainingPaths(next)).toEqual(['naruteo/a.jpg', 'naruteo/c.jpg']);
  });

  it('빼면 뒤가 앞으로 당겨진다', () => {
    expect(remainingPaths(removeSlot(slots, 0))).toEqual(['naruteo/b.jpg', 'naruteo/c.jpg']);
  });
});
