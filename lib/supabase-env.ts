/**
 * Supabase 접속 정보 — 이 저장소에서 유일한 원본.
 *
 * 클라이언트가 셋(공개 조회 · 브라우저 세션 · 서버 세션)으로 갈라지면서
 * 같은 검사를 세 번 쓰게 됐다. 검사를 여기 하나로 모아 셋이 함께 실패하게 한다.
 *
 * 폴백은 두지 않는다. 조용히 다른 곳을 보게 되면 화면이 실제 DB와 다른 것을
 * 보여주기 때문이다 (CLAUDE.md — 환경변수).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 .env.local에 필요합니다. ' +
      '.env.example을 참고해 채운 뒤 개발 서버를 다시 시작하세요.',
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;
