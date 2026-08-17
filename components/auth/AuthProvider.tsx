'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * 세션 상태를 한 곳에서 들고 하위로 내린다.
 *
 * 원래 AuthDock 안에 있던 것을 끌어올렸다. 북마크가 붙으면서 세션을 보는 곳이
 * 셋(dock 버튼, 북마크 패널, 상세의 하트)이 됐고, 각자 getUser()를 부르면 구독도
 * 셋이 되고 로그아웃 반영 시점도 서로 어긋난다.
 *
 * 세션을 서버가 아니라 여기서 읽는 이유는 그대로다 — app/page.tsx에서 쿠키를
 * 읽으면 그 라우트가 동적 렌더로 바뀌어 revalidate = 300이 죽는다.
 */
interface AuthState {
  user: User | null;
  /** 세션 판정이 끝났는가. 끝나기 전에는 로그인/프로필 어느 쪽도 그리지 않는다 */
  resolved: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다');
  }
  return value;
}

/**
 * 콜백이 ?auth_error=로 돌려보낸 실패 문구를 꺼내고 주소에서 지운다.
 * 지우지 않으면 새로고침할 때마다 지난 실패가 다시 뜬다.
 *
 * 결과를 모듈에 캐시한다. StrictMode가 effect를 두 번 돌리면 두 번째 호출은 이미
 * 비워진 주소를 읽어 null을 내놓고, 그게 첫 번째가 잡은 문구를 덮어쓴다.
 * 문서 로드마다 초기화되므로 다음 실패는 정상적으로 다시 잡힌다.
 */
let consumed: string | null | undefined;

function takeAuthError() {
  if (consumed !== undefined) return consumed;

  const params = new URLSearchParams(window.location.search);
  const message = params.get('auth_error');
  consumed = message;
  if (!message) return null;

  params.delete('auth_error');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
  return message;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      // 로그인 실패도 세션 판정과 같은 시점에 확정한다. 별도 effect로 떼면
      // 화면이 두 번 흔들리고, effect 본문에서 setState를 직접 부르게 된다.
      setError(takeAuthError());
      setResolved(true);
    });

    // 로그인·로그아웃·토큰 갱신을 한 곳에서 받는다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setResolved(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    const { error: signInError } = await getBrowserSupabase().auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) setError(signInError.message);
  }, []);

  const signOut = useCallback(async () => {
    await getBrowserSupabase().auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, resolved, error, signIn, signOut }),
    [user, resolved, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
