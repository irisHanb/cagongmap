/**
 * 배포 주소. metadataBase·canonical·OG 이미지 절대 URL이 전부 여기서 나온다.
 *
 * Next 16은 metadataBase 없이 상대 경로를 쓰면 경고가 아니라 **빌드 에러**를 낸다
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md).
 * 그리고 카카오톡·디스코드 스크래퍼는 상대 경로 og:image를 읽지 못하므로, 이 값이
 * 없으면 공유 카드에 이미지가 빠진다.
 *
 * 하드코딩하지 않는 이유는 next.config.ts가 Supabase 호스트를 다루는 것과 같다 —
 * 도메인을 옮기면 .env만 바꾼다.
 *
 * ⚠️ Supabase 쪽(lib/supabase-env.ts)과 달리 여기에는 폴백을 둔다. 틀린 사이트 주소는
 * 화면에 틀린 데이터를 띄우지 않고, env가 없다고 `npm run build`가 죽으면 저장소를
 * 갓 클론한 사람이 아무것도 못 한다.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cagongmap-nu.vercel.app';

export const SITE_NAME = '카공맵';
export const SITE_TITLE = '카공맵 — 노트북 작업하기 좋은 카페 지도';
export const SITE_DESCRIPTION = '콘센트·와이파이·소음으로 작업하기 좋은 카페를 지도에서 찾습니다.';
