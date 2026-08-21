import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ★ 저장 순서를 못 박는 테스트
 *
 * `savePlaceAction()`에서 가장 위험한 것은 검증이 아니라 **호출 순서**다.
 * 승인 RPC 안의 `attach_submission_photos()`가 제보 사진을 `places.photos`에
 * **이어 붙이므로**, `setPlacePhotos()`가 승인보다 뒤에 오면 방금 붙은 사진을
 * 덮어쓴다. 화면에서는 "사진이 좀 적네" 정도로만 보이고 타입도 린트도 잡지 못한다.
 *
 * 그래서 실제 DB 대신 **호출 순서를 기록**해 그것만 본다. 세션이 필요 없어
 * `npm run verify`에서 매번 돈다.
 */
const calls = vi.hoisted(() => [] as string[]);
type RpcResult = { error: { message: string } | null };
/** 구현 없이 시그니처만 준다. 기본 반환값은 beforeEach가 세운다 */
const rpc = vi.hoisted(() =>
  vi.fn<(name: string, args: Record<string, unknown>) => Promise<RpcResult>>(),
);

vi.mock('@/lib/admin/guard', () => ({
  requireCurator: vi.fn(async () => ({ id: 'curator-uuid', nickname: '나', role: 'curator' })),
}));

vi.mock('@/lib/admin/places', () => ({
  insertPlace: vi.fn(async () => {
    calls.push('insertPlace');
    return { id: 'place-uuid', slug: 'naruteo' };
  }),
  updatePlace: vi.fn(async () => {
    calls.push('updatePlace');
    return { id: 'place-uuid', slug: 'naruteo' };
  }),
  uploadPlacePhotos: vi.fn(async (folder: string, files: File[]) => {
    calls.push(`uploadPlacePhotos(${folder})`);
    return files.map((_, index) => `${folder}/new-${index}.jpg`);
  }),
  setPlacePhotos: vi.fn(async (_id: string, paths: string[]) => {
    calls.push(`setPlacePhotos(${paths.join('|')})`);
  }),
  removePlacePhotos: vi.fn(async (paths: string[]) => {
    calls.push(`removePlacePhotos(${paths.join('|')})`);
  }),
}));

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: vi.fn(async () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push(`rpc:${name}`);
      return rpc(name, args);
    },
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { savePlaceAction } = await import('@/app/admin/places/actions');
const { EMPTY_PLACE_FORM } = await import('@/lib/admin/place-form');

/** 검증을 통과하는 최소한의 폼 */
const values = {
  ...EMPTY_PLACE_FORM,
  name: '나루터',
  address: '서울 송파구 백제고분로 000',
  lat: '37.5078',
  lng: '127.1072',
  open_time: '12:00',
  close_time: '00:00',
};

beforeEach(() => {
  calls.length = 0;
  rpc.mockClear();
  rpc.mockResolvedValue({ error: null });
});

describe('savePlaceAction — 저장 순서', () => {
  it('승인 RPC가 photos 쓰기보다 뒤에 온다', async () => {
    const result = await savePlaceAction({
      values,
      photoPlan: [{ kind: 'new', index: 0 }],
      files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })],
      originalPhotos: [],
      reportId: 'report-uuid',
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'insertPlace',
      'uploadPlacePhotos(naruteo)',
      'setPlacePhotos(naruteo/new-0.jpg)',
      // 빠진 사진이 없으면 removePlacePhotos는 빈 배열로 불린다
      'removePlacePhotos()',
      'rpc:approve_place_report',
    ]);

    // ⚠️ 이 줄이 이 테스트의 전부다. 뒤집히면 제보 사진이 사라진다.
    expect(calls.indexOf('rpc:approve_place_report')).toBeGreaterThan(
      calls.findIndex((call) => call.startsWith('setPlacePhotos')),
    );

    // 승인자(세 번째 인자)를 넘기지 않는다. 세션이 있으면 resolve_reviewer()가
    // auth.uid()를 먼저 보므로 인자는 무시된다.
    expect(rpc).toHaveBeenCalledWith('approve_place_report', {
      p_report_id: 'report-uuid',
      p_place_id: 'place-uuid',
    });
  });

  it('수정 요청 승인도 마지막이다', async () => {
    await savePlaceAction({
      id: 'place-uuid',
      values,
      photoPlan: [],
      files: [],
      originalPhotos: [],
      requestId: 'request-uuid',
    });

    expect(calls[0]).toBe('updatePlace');
    expect(calls.at(-1)).toBe('rpc:approve_edit_request');
  });

  it('승인할 것이 없으면 RPC를 부르지 않는다', async () => {
    await savePlaceAction({ values, photoPlan: [], files: [], originalPhotos: [] });
    expect(calls.some((call) => call.startsWith('rpc:'))).toBe(false);
  });
});

describe('savePlaceAction — 사진', () => {
  it('plan의 순서가 최종 배열의 순서다', async () => {
    await savePlaceAction({
      id: 'place-uuid',
      values,
      photoPlan: [
        { kind: 'new', index: 0 },
        { kind: 'existing', path: 'naruteo/old.jpg' },
        { kind: 'new', index: 1 },
      ],
      files: [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['y'], 'b.jpg', { type: 'image/jpeg' }),
      ],
      originalPhotos: ['naruteo/old.jpg'],
    });

    expect(calls).toContain('setPlacePhotos(naruteo/new-0.jpg|naruteo/old.jpg|naruteo/new-1.jpg)');
  });

  /** 제보 사진은 승인 RPC가 붙인다. 폼이 또 넣으면 두 장이 된다 */
  it('빠진 사진 중 검수 폴더 것은 지우지 않는다', async () => {
    await savePlaceAction({
      id: 'place-uuid',
      values,
      photoPlan: [],
      files: [],
      originalPhotos: ['naruteo/a.jpg', 'submissions/uid/b.jpg'],
    });

    expect(calls).toContain('removePlacePhotos(naruteo/a.jpg)');
  });
});

describe('savePlaceAction — 실패', () => {
  it('검증에 걸리면 아무것도 부르지 않는다', async () => {
    const result = await savePlaceAction({
      values: { ...values, name: '' },
      photoPlan: [],
      files: [],
      originalPhotos: [],
    });

    expect(result).toEqual({ ok: false, errors: ['이름을 넣어주세요'] });
    expect(calls).toEqual([]);
  });

  /**
   * 승인만 실패했을 때 되돌리지 않는다. 되돌리면 사용자가 다시 저장을 눌러
   * 같은 카페가 하나 더 생긴다.
   */
  it('승인이 실패해도 장소 저장은 성공으로 남고 경고를 올린다', async () => {
    rpc.mockResolvedValue({ error: { message: '이미 처리된 제보입니다 (status=approved)' } });

    const result = await savePlaceAction({
      values,
      photoPlan: [],
      files: [],
      originalPhotos: [],
      reportId: 'report-uuid',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.warning).toContain('제보 승인에 실패');
    expect(calls).toContain('insertPlace');
  });
});
