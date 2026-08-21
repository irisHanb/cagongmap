/**
 * ★ 사진 파일 규칙 — **한 파일에 대한 판정만** 둔다
 *
 * `lib/submissions.ts`에서 갈라 나왔다. 그쪽은 세션 클라이언트를 쓰는 **브라우저
 * 전용** 파일이라 서버에서 import할 수 없는데, 관리자 화면의 서버 액션도 올라오는
 * 파일을 같은 기준으로 걸러야 한다. 규칙이 두 벌이 되면 한쪽만 고쳐지는 날이 온다.
 *
 * 여기 없는 것: **개수 상한.** 그것은 파일의 성질이 아니라 폼마다 다른 정책이다
 * (제보는 5장, 관리자는 상한을 두지 않는다).
 */

/** 버킷의 file_size_limit과 같아야 한다. 다르면 다 올린 뒤 서버에서 튕긴다 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** 버킷의 allowed_mime_types와 같아야 한다. 값은 저장할 때 쓸 확장자다 */
export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** 통과하면 null, 걸리면 사유 한 줄 */
export function photoFileReason(file: File): string | null {
  if (!ALLOWED_MIME[file.type]) return 'JPG, PNG, WebP 사진만 올릴 수 있어요';
  if (file.size > MAX_PHOTO_BYTES) return '사진 한 장은 5MB까지예요';
  return null;
}

/** 여러 장 중 처음 걸리는 사유. 개수는 보지 않는다 */
export function photoFilesReason(files: File[]): string | null {
  for (const file of files) {
    const reason = photoFileReason(file);
    if (reason) return reason;
  }
  return null;
}

/** 파일의 MIME → 저장할 확장자. 허용 목록 밖이면 undefined */
export function extensionFor(type: string): string | undefined {
  return ALLOWED_MIME[type];
}
