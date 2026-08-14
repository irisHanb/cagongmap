import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트.
 *
 * anon 키로만 접근한다. places는 RLS가 status='published'만 열어주므로
 * 이 키로는 draft·hidden·closed를 볼 수도, 어떤 카페를 고칠 수도 없다
 * (docs/db-schema.md 참고).
 *
 * NEXT_PUBLIC_ 접두사라 값을 바꾸면 개발 서버를 재시작해야 반영된다.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 .env.local에 필요합니다. ' +
      '.env.example을 참고해 채운 뒤 개발 서버를 다시 시작하세요.',
  );
}

export const supabase = createClient(url, anonKey, {
  // 로그인이 아직 없다. 서버 렌더링에서 세션을 들고 있을 이유도 없다.
  auth: { persistSession: false },
});
