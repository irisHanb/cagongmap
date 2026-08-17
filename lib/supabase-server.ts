import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-env';

/**
 * 서버 세션 클라이언트 — route handler와 서버 액션 전용.
 *
 * 쿠키를 읽으므로 이걸 서버 컴포넌트에서 쓰면 그 라우트가 통째로 동적 렌더가 된다.
 * app/page.tsx의 revalidate = 300을 지키려고 카페 조회에는 쓰지 않는다.
 * 공개 데이터는 lib/supabase.ts를 쓴다.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // 서버 컴포넌트에서 호출되면 쿠키를 쓸 수 없어 throw한다.
        // 세션 갱신은 proxy.ts가 맡으므로 여기서는 삼켜도 안전하다.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // noop
        }
      },
    },
  });
}
