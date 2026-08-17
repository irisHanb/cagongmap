import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-env';

/**
 * 세션 토큰 갱신.
 *
 * Next 16에서 middleware.ts는 proxy.ts로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md).
 * Supabase 문서의 middleware.ts 예제를 그대로 옮기면 파일이 무시된다.
 *
 * 브라우저는 만료된 access token을 스스로 갱신하지만, 서버는 요청이 들어온 순간의
 * 쿠키만 본다. 여기서 getUser()를 한 번 불러 갱신된 토큰을 응답 쿠키에 다시 심는다.
 * 이걸 빼면 탭을 오래 열어둔 뒤의 서버 요청이 로그아웃 상태로 보인다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getSession()이 아니라 getUser()다. getSession()은 쿠키를 그대로 믿지만
  // getUser()는 Auth 서버에 확인하므로 갱신이 실제로 일어난다.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 정적 파일과 이미지 최적화 요청에서는 세션을 갱신할 이유가 없다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
