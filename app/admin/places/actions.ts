'use server';

import { revalidatePath } from 'next/cache';
import { requireCurator } from '@/lib/admin/guard';
import {
  buildPlacePayload,
  deletablePaths,
  validatePlaceForm,
  type PlaceFormValues,
} from '@/lib/admin/place-form';
import {
  insertPlace,
  removePlacePhotos,
  setPlacePhotos,
  updatePlace,
  uploadPlacePhotos,
} from '@/lib/admin/places';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * 사진 한 칸의 **직렬화 가능한** 모양.
 *
 * `PhotoSlot`을 그대로 보내지 않는 이유는 그 안에 File이 섞여 있어서다. 서버 액션의
 * 인자로 File을 보낼 수는 있지만, 순서 정보와 파일을 한 배열에 담으면 어느 파일이
 * 몇 번째 칸인지가 직렬화를 지나며 흐려진다. 순서(plan)와 파일(files)을 갈라
 * `index`로 잇는다.
 */
export type PhotoPlanItem = { kind: 'existing'; path: string } | { kind: 'new'; index: number };

export interface SavePlaceInput {
  /** 없으면 새로 만든다 */
  id?: string;
  values: PlaceFormValues;
  photoPlan: PhotoPlanItem[];
  files: File[];
  /** 저장 전 `places.photos`. 무엇이 빠졌는지 계산하는 데 쓴다 */
  originalPhotos: string[];
  /** 대기 중인 신규 제보를 이 저장으로 승인한다면 그 id */
  reportId?: string;
  /** 대기 중인 수정 요청을 이 저장으로 승인한다면 그 id */
  requestId?: string;
}

export type SavePlaceResult =
  | { ok: true; id: string; warning?: string }
  | { ok: false; errors: string[] };

/**
 * 장소 저장 — 그리고 필요하면 제보 승인까지.
 *
 * ⚠️ **순서가 고정이다. 바꾸면 사진이 조용히 사라진다.**
 *
 *   1. `places` 쓰기 (photos는 건드리지 않는다)
 *   2. 새로 고른 파일 업로드
 *   3. `places.photos`를 최종 배열로 쓰기
 *   4. 빠진 파일 정리
 *   5. **마지막에** 승인 RPC
 *
 * 5가 마지막인 이유: `approve_place_report()`·`approve_edit_request()` 안의
 * `attach_submission_photos()`가 제보 사진을 `places.photos`에 **이어 붙인다.**
 * 3이 5보다 뒤에 오면 방금 붙은 제보 사진을 덮어쓴다. 테스트로 잡기 어렵고 화면에서도
 * "사진이 좀 적네" 정도로만 보이는 종류의 버그다.
 *
 * 같은 이유로 **제보 사진을 폼에서 복사하지 않는다.** 복사하면 승인 RPC가 한 번 더
 * 붙여 같은 사진이 두 장이 된다.
 */
export async function savePlaceAction(input: SavePlaceInput): Promise<SavePlaceResult> {
  // ⚠️ 서버 액션은 app/admin/layout.tsx의 가드 뒤에 있지 않다. 별도 POST
  //    엔드포인트로 직접 호출할 수 있으므로 여기서 다시 판정한다.
  try {
    await requireCurator();
  } catch {
    return { ok: false, errors: ['관리자만 할 수 있는 작업입니다'] };
  }

  const errors = validatePlaceForm(input.values);
  if (errors.length > 0) return { ok: false, errors };

  const payload = buildPlacePayload(input.values);

  try {
    // 1. places 쓰기
    const place = input.id ? await updatePlace(input.id, payload) : await insertPlace(payload);

    // 2. 새 파일 업로드. 폴더는 slug, 아직 없으면 uuid다 — 어느 쪽이든 places.photos에
    //    담기는 것은 경로이고 URL이 아니다.
    const folder = place.slug ?? place.id;
    const uploaded = await uploadPlacePhotos(folder, input.files);

    // 3. 최종 배열. plan의 순서가 곧 화면의 순서다
    const photos = input.photoPlan.map((item) =>
      item.kind === 'existing' ? item.path : uploaded[item.index],
    );
    await setPlacePhotos(place.id, photos);

    // 4. 빠진 파일 정리. `submissions/` 아래는 제보 row가 여전히 가리키므로 남긴다
    await removePlacePhotos(deletablePaths(input.originalPhotos, photos));

    // 5. 승인. 실패해도 되돌리지 않는다 — 장소는 이미 저장됐고 그것은 유효한 결과다
    const warning = await approveIfAsked(input, place.id);

    revalidatePath('/admin/places');
    revalidatePath('/admin/reports');
    // 공개 화면의 카페 목록 캐시(app/page.tsx의 revalidate = 300)를 지금 무효화한다.
    // 없으면 방금 만든 카페가 최대 5분 동안 지도에 뜨지 않는다.
    revalidatePath('/');
    revalidatePath('/cafes');

    return warning ? { ok: true, id: place.id, warning } : { ok: true, id: place.id };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : '저장하지 못했습니다'] };
  }
}

/**
 * 승인 RPC. 부를 것이 없으면 undefined.
 *
 * **던지지 않는다.** 여기서 던지면 위의 catch가 "저장하지 못했습니다"를 돌려주는데,
 * 그 시점에 장소는 이미 저장돼 있다. 사용자가 다시 저장을 누르면 같은 카페가 하나 더
 * 생긴다. 그래서 실패는 경고로 올려 보내고 장소 저장은 성공으로 남긴다.
 *
 * 세 번째 인자(승인자)를 넘기지 않는다. 세션이 있으므로 `resolve_reviewer()`가
 * `auth.uid()`를 먼저 보고 인자는 무시된다.
 */
async function approveIfAsked(input: SavePlaceInput, placeId: string): Promise<string | undefined> {
  if (!input.reportId && !input.requestId) return undefined;

  const supabase = await createServerSupabase();

  const { error } = input.reportId
    ? await supabase.rpc('approve_place_report', {
        p_report_id: input.reportId,
        p_place_id: placeId,
      })
    : await supabase.rpc('approve_edit_request', { p_request_id: input.requestId });

  if (error) {
    return `장소는 저장했지만 제보 승인에 실패했어요: ${error.message}`;
  }
  return undefined;
}
