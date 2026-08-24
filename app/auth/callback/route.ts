import { NextResponse, type NextRequest } from 'next/server';
import { log, requestId } from '@/lib/log';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * 카카오 로그인이 끝나고 돌아오는 자리.
 *
 * @supabase/ssr의 브라우저 클라이언트는 PKCE로 동작한다. code verifier가 쿠키에
 * 있으므로 교환을 서버에서 해야 세션 쿠키가 httpOnly로 심긴다.
 *
 * Supabase 대시보드 > Authentication > URL Configuration의 Redirect URLs에
 * http://localhost:3030/** 가 들어 있어야 여기까지 온다.
 *
 * ⚠️ **`code`를 로그에 넣지 않는다.** 세션과 바꿀 수 있는 자격증명이다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rid = requestId();
  const started = Date.now();

  // 사용자가 카카오 동의 화면에서 취소하면 code 대신 error가 온다.
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error');

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      log('info', 'auth.login', {
        request_id: rid,
        user_id: data.user?.id,
        provider: 'kakao',
        outcome: 'ok',
        duration_ms: Date.now() - started,
      });
      return NextResponse.redirect(`${origin}/`);
    }
    log('warn', 'auth.login', {
      request_id: rid,
      provider: 'kakao',
      outcome: 'error',
      // 교환 실패 사유. 토큰이 아니라 Supabase가 준 설명이다
      reason: error.message,
      duration_ms: Date.now() - started,
    });
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  }

  log('warn', 'auth.login', {
    request_id: rid,
    provider: 'kakao',
    outcome: 'error',
    // 동의 취소가 대부분이라 error가 아니라 warn이다
    reason: oauthError ?? 'no_code',
  });

  return NextResponse.redirect(
    `${origin}/?auth_error=${encodeURIComponent(oauthError ?? '로그인이 완료되지 않았습니다')}`,
  );
}
