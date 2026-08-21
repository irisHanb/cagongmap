import { resolvePlaceId } from '@/lib/place-id';
import { ALLOWED_MIME, photoFilesReason } from '@/lib/photo-rules';
import { PLACE_IMAGE_BUCKET, placeImagePath, placeImageUrl } from '@/lib/place-images';
import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * ★ 제보 데이터 접근 계층
 *
 * lib/cafes.ts · lib/bookmarks.ts와 같은 규칙이다. 컴포넌트는 테이블과 Storage를
 * 직접 건드리지 않는다. 세션이 필요하므로 **브라우저 전용**이다.
 *
 * 테이블이 둘이다. 담는 정보가 다르기 때문이다.
 *
 *  - place_reports        — 새 장소 제보. 네이버 URL이 필수다.
 *  - place_edit_requests  — 기존 장소 수정 요청. 대상 카페가 필수다.
 *
 * 한 테이블에 kind로 몰아 두면 그 둘이 다 nullable이 되고, 무엇이 반드시 있어야
 * 하는지를 DB가 보장하지 못한다.
 *
 * 사진은 **제출할 때** 올라간다. 고르는 즉시 올리면 폼을 닫고 마음을 바꾼 사람의
 * 파일이 버킷에 남기 때문이다. 대신 올린 뒤 insert가 실패할 수 있으므로, 그때는
 * removePhotos()가 그 자리에서 되돌린다.
 */

/**
 * 사진은 카페 사진과 **같은 버킷**에 올라간다. 검수 전에는 submissions/<uid>/ 아래에
 * 있고, 승인되면 <slug>/ 아래로 옮겨간다 — 버킷을 건너뛰지 않으므로 경로만 바뀐다.
 * storage 정책이 이 접두사로 쓰기를 제한한다.
 */
export const SUBMISSION_PREFIX = 'submissions';

export const MAX_PHOTOS = 5;

/**
 * 파일 하나에 대한 규칙(형식·크기)은 `lib/photo-rules.ts`에 있다. 관리자 화면의
 * 서버 액션이 같은 기준을 써야 하는데 이 파일은 세션 클라이언트를 쓰는 브라우저
 * 전용이라 서버에서 import할 수 없어 갈랐다.
 *
 * 여기 남은 것은 **이 폼의 정책** — 5장 상한 — 하나뿐이다.
 */
export { ALLOWED_MIME, MAX_PHOTO_BYTES } from '@/lib/photo-rules';

/**
 * 파일 검증. 통과하면 null, 걸리면 사유 한 줄.
 *
 * 버킷이 file_size_limit·allowed_mime_types로 같은 것을 다시 막는다. 여기서 보는
 * 이유는 막기 위해서가 아니라, 5MB를 다 올려보낸 뒤 실패하는 대신 고르는 즉시
 * 이유를 말해 주기 위해서다.
 */
export function checkPhotos(files: File[]): string | null {
  if (files.length > MAX_PHOTOS) {
    return `사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요`;
  }
  return photoFilesReason(files);
}

/**
 * 네이버 플레이스 URL인지 본다.
 *
 * host 끝만 본다 — m.place.naver.com, map.naver.com, naver.me가 전부 유효하고,
 * 경로 모양은 네이버가 바꿀 수 있어서 잡지 않는다. 잘못된 URL을 통과시키는 것보다
 * 사용자가 아는 링크를 막는 쪽이 더 나쁘다.
 */
export function isNaverPlaceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  return url.hostname === 'naver.com'
    || url.hostname.endsWith('.naver.com')
    || url.hostname === 'naver.me'
    || url.hostname.endsWith('.naver.me');
}

/**
 * Postgres 에러를 사람이 읽을 문구로.
 *
 * 두 테이블 다 "같은 사람이 같은 대상에 대기 중 요청 하나"를 부분 unique 인덱스로
 * 막는다. 그때 나오는 것은 `duplicate key value violates unique constraint ...`인데,
 * 그대로 띄우면 사용자는 자기가 무엇을 잘못했는지 알 수 없다.
 */
function translate(code: string | undefined, fallback: string): string {
  if (code === '23505') {
    return '이미 검토를 기다리는 요청이 있어요. 그 요청이 처리된 뒤에 다시 보낼 수 있어요';
  }
  return fallback;
}

async function currentUserId(): Promise<string> {
  const { data } = await getBrowserSupabase().auth.getUser();
  if (!data.user) {
    throw new Error('로그인이 필요합니다');
  }
  return data.user.id;
}

/**
 * 사진을 올리고 **공개 URL**을 돌려준다.
 *
 * 올라가는 자리는 카페 사진과 같은 버킷의 `submissions/<uid>/` 아래이고, storage
 * 정책이 그 두 칸을 본다. 파일명에 원본 이름을 쓰지 않는다 — 한글·공백·중복이
 * 그대로 키가 되고, 사용자가 올린 문자열이 경로가 되는 것 자체가 좋지 않다.
 *
 * 경로가 아니라 URL을 돌려주는 이유는 저장할 컬럼이 URL을 담기 때문이다. 검수하는
 * 사람이 대시보드에서 값을 그대로 열어볼 수 있어야 한다(lib/place-images.ts).
 */
export async function uploadPhotos(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];

  const reason = checkPhotos(files);
  if (reason) throw new Error(reason);

  const uid = await currentUserId();
  const storage = getBrowserSupabase().storage.from(PLACE_IMAGE_BUCKET);

  const urls: string[] = [];
  for (const file of files) {
    const path = `${SUBMISSION_PREFIX}/${uid}/${crypto.randomUUID()}.${ALLOWED_MIME[file.type]}`;
    const { error } = await storage.upload(path, file, { contentType: file.type });

    if (error) {
      // 두 번째 장에서 실패하면 첫 번째 장이 버킷에 남는다. 되돌리고 던진다.
      await removePhotos(urls);
      throw new Error(`사진을 올리지 못했습니다: ${error.message}`);
    }
    urls.push(placeImageUrl(path));
  }

  return urls;
}

/**
 * 올려둔 사진을 지운다. **제출이 실패했을 때 뒷정리용이다.**
 *
 * 사진은 제출 버튼을 누를 때 올라가고 insert가 그 뒤에 온다. 중간에 실패하면
 * (중복 제보처럼) 아무도 가리키지 않는 파일이 버킷에 남으므로 그 자리에서 치운다.
 * storage 정책이 `submissions/<본인 uid>/`에 delete를 열어 두었기 때문에 사용자
 * 세션만으로 된다 — 운영자 키가 필요 없다.
 *
 * **실패해도 던지지 않는다.** 여기서 던지면 사용자가 알아야 할 원래 실패
 * ("이미 검토를 기다리는 요청이 있어요")를 덮어쓴다. 지우지 못한 파일은
 * scripts/prune-orphan-photos.mjs가 나중에 걷어간다 — 그쪽은 안전망이고 이쪽이 1차다.
 */
export async function removePhotos(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const { error } = await getBrowserSupabase()
    .storage.from(PLACE_IMAGE_BUCKET)
    .remove(urls.map(placeImagePath));

  if (error) {
    console.warn('올린 사진을 지우지 못했습니다:', error.message);
  }
}

export interface SubmissionInput {
  files: File[];
  note: string;
}

/**
 * 기존 카페 수정 요청.
 *
 * status와 submitted_by는 넣지 않는다. 컬럼 default가 각각 'pending'과 auth.uid()이고,
 * insert 정책의 with check가 그 둘을 검사한다. 값을 실어 보내면 검사할 거리를
 * 우리가 만들어 주는 셈이다.
 */
export async function submitEdit(cafeId: string, { files, note }: SubmissionInput): Promise<void> {
  // 사진보다 먼저 푼다. insert 인자 안에서 풀면 여기서 던졌을 때 아래 rollback을
  // 지나치지 못하고 빠져나가, 방금 올린 사진이 주인 없이 남는다.
  const placeId = await resolvePlaceId(cafeId);
  const photos = await uploadPhotos(files);

  const { error } = await getBrowserSupabase()
    .from('place_edit_requests')
    .insert({
      place_id: placeId,
      photos,
      note: note.trim() || null,
    });

  if (error) {
    // 실패했으면 방금 올린 사진은 가리키는 곳이 없다. 그 자리에서 치운다.
    await removePhotos(photos);
    throw new Error(translate(error.code, `수정 요청을 보내지 못했습니다: ${error.message}`));
  }
}

export interface NewPlaceInput extends SubmissionInput {
  naverUrl: string;
  /**
   * 가게 이름. **선택이다.**
   *
   * 네이버 링크에서 상호를 뽑을 방법이 없어서 직접 받는다 — naver.me는 장소 ID만
   * 담은 주소로 리다이렉트하고 그 페이지는 이름을 클라이언트에서 렌더한다
   * (마이그레이션 20260821082721의 주석에 확인 과정이 있다).
   *
   * 비워도 제보는 된다. 필수로 만들면 문턱만 올라가고, 그때는 검수하는 사람이
   * 링크를 열어 확인하던 예전 흐름 그대로다.
   */
  placeName?: string;
}

/**
 * 새 장소 제보.
 *
 * place_id를 넣지 않는다. 아직 카페가 없기 때문이고, place_reports_pending_has_no_place가
 * 그것을 강제한다. 승인 시점에 approve_place_report()가 큐레이터가 만든 카페를
 * 가리키게 채운다.
 */
export async function submitNewPlace({
  naverUrl,
  placeName,
  files,
  note,
}: NewPlaceInput): Promise<void> {
  const url = naverUrl.trim();
  if (!isNaverPlaceUrl(url)) {
    throw new Error('네이버 지도 링크를 넣어주세요');
  }

  const photos = await uploadPhotos(files);

  const { error } = await getBrowserSupabase()
    .from('place_reports')
    .insert({
      naver_place_url: url,
      // 빈 문자열을 넣지 않는다. DB의 check가 공백만 든 값을 거부한다.
      place_name: placeName?.trim() || null,
      photos,
      note: note.trim() || null,
    });

  if (error) {
    await removePhotos(photos);
    throw new Error(translate(error.code, `제보를 보내지 못했습니다: ${error.message}`));
  }
}
