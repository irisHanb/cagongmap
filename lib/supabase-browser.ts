import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-env';

/**
 * 브라우저 세션 클라이언트 — 클라이언트 컴포넌트 전용.
 *
 * localStorage가 아니라 쿠키에 세션을 쓴다. 그래야 같은 세션을 서버(route handler,
 * proxy.ts, 나중에 붙일 서버 컴포넌트)에서도 읽을 수 있다.
 *
 * 인스턴스를 모듈 안에 붙잡아 둔다. 렌더마다 새로 만들면 onAuthStateChange 구독이
 * 매번 갈리고, PKCE code verifier를 들고 있는 쪽과 교환하는 쪽이 어긋난다.
 *
 * 타입은 SupabaseClient로 적는다. ReturnType<typeof createBrowserClient>는 제네릭
 * 기본값이 any로 풀려 콜백 인자가 전부 암묵적 any가 된다.
 */
let client: SupabaseClient | null = null;

export function getBrowserSupabase() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
