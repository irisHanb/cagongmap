import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-env';

/**
 * 공개 데이터 조회 전용 클라이언트.
 *
 * anon 키로만 접근한다. places는 RLS가 status='published'만 열어주므로
 * 이 키로는 draft·hidden·closed를 볼 수도, 어떤 카페를 고칠 수도 없다
 * (docs/db-schema.md 참고).
 *
 * 세션을 들지 않는 것이 핵심이다. 이 클라이언트가 쿠키를 읽기 시작하면
 * app/page.tsx의 revalidate = 300이 무의미해진다 — 요청마다 동적 렌더가 되기 때문이다.
 * 로그인 세션은 supabase-browser.ts / supabase-server.ts가 따로 맡는다.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
