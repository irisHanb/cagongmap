import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * 카카오 로그인이 끝나고 돌아오는 자리.
 *
 * @supabase/ssr의 브라우저 클라이언트는 PKCE로 동작한다. code verifier가 쿠키에
 * 있으므로 교환을 서버에서 해야 세션 쿠키가 httpOnly로 심긴다.
 *
 * Supabase 대시보드 > Authentication > URL Configuration의 Redirect URLs에
 * http://localhost:3030/** 가 들어 있어야 여기까지 온다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // 사용자가 카카오 동의 화면에서 취소하면 code 대신 error가 온다.
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(
    `${origin}/?auth_error=${encodeURIComponent(oauthError ?? '로그인이 완료되지 않았습니다')}`,
  );
}
