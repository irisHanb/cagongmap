import { supabase } from '@/lib/supabase';

/**
 * ★ 카페 사진의 유일한 출처
 *
 * **카페 이미지는 전부 Supabase Storage의 place-images 버킷을 쓴다.** 외부 CDN
 * 이미지를 화면에 얹지 않는다 — 카카오맵 API 응답에서 온 URL을 저장하지 않는다는
 * 결정(docs/mvp-decisions.md 크롤링 금지)이 그 이유고, 저작권을 확인한 사진만
 * 올린다는 결정도 여기에 걸려 있다.
 *
 * **테이블마다 담는 모양이 다르다. 목적이 다르기 때문이다.**
 *
 *  - `places.photos` — 경로(`naruteo.jpeg`). 오래 남고 앱이 매번 읽는 값이라, URL을
 *    담으면 프로젝트 ref가 데이터에 박혀 프로젝트를 옮길 때 전부 죽는다.
 *  - `place_reports.photos` · `place_edit_requests.photos` — 공개 URL. 검수하는
 *    사람이 대시보드에서 값을 그대로 클릭해 사진을 열 수 있어야 한다. 검수가 끝나면
 *    수명이 끝나는 데이터라 ref가 박히는 대가를 치를 만하다.
 *
 * 어느 쪽이든 조립과 해체는 이 파일에서만 한다.
 *
 * getPublicUrl은 문자열을 만들 뿐 네트워크를 타지 않는다. 그래서 서버 컴포넌트에서
 * 부르는 것도 안전하고, app/page.tsx의 revalidate = 300도 그대로 산다.
 */

/**
 * 버킷은 하나다. 검수 전 제보 사진도 여기 들어가고(`submissions/<uid>/`),
 * 승인되면 같은 버킷 안에서 `<slug>/`로 옮겨간다. 두 버킷을 오가지 않으므로
 * 승인이 파일 이동이 아니라 경로 변경으로 끝난다.
 */
export const PLACE_IMAGE_BUCKET = 'place-images';

export function placeImageUrl(path: string): string {
  return supabase.storage.from(PLACE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 공개 URL → 버킷 경로. 되짚는 쪽도 여기 둔다 (승인 때 파일을 옮기려면 경로가 필요하다) */
export function placeImagePath(url: string): string {
  const marker = `/storage/v1/object/public/${PLACE_IMAGE_BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? url : url.slice(at + marker.length);
}
