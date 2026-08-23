'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * 로그인이 필요해진 이유. 모달 문구가 이것으로 갈린다 — "저장하려면"과
 * "평가하려면"은 사용자가 방금 누른 것이 다르므로 같은 문장일 수 없다.
 */
export type LoginReason = 'bookmark' | 'review' | 'submission';

/**
 * 세션 상태를 한 곳에서 들고 하위로 내린다.
 *
 * 원래 AuthDock 안에 있던 것을 끌어올렸다. 북마크가 붙으면서 세션을 보는 곳이
 * 셋(dock 버튼, 북마크 패널, 상세의 하트)이 됐고, 각자 getUser()를 부르면 구독도
 * 셋이 되고 로그아웃 반영 시점도 서로 어긋난다.
 *
 * 세션을 서버가 아니라 여기서 읽는 이유는 그대로다 — app/page.tsx에서 쿠키를
 * 읽으면 그 라우트가 동적 렌더로 바뀌어 revalidate = 300이 죽는다.
 *
 * 2026-08-20에 로그인 유도(requireLogin)도 여기로 올렸다. 원래 BookmarkProvider가
 * 들고 있었는데, 리뷰와 제보가 붙으면서 로그인이 필요한 자리가 셋이 됐다. 판정이
 * 셋으로 흩어지면 "로그인 유도는 화면당 하나"(DESIGN.md)를 지킬 수 없다.
 */
interface AuthState {
  user: User | null;
  /** 세션 판정이 끝났는가. 끝나기 전에는 로그인/프로필 어느 쪽도 그리지 않는다 */
  resolved: boolean;
  /**
   * 이 사람이 큐레이터인가. dock에 운영 화면 입구를 보여줄지가 여기 걸려 있다.
   *
   * ⚠️ **이것은 표시용 판정이지 접근 제어가 아니다.** anon 키는 브라우저에 그대로
   * 나가므로 클라이언트 판정은 언제든 조작할 수 있다. 실제 방어선은 셋이고 전부
   * 서버에 있다 — `/admin` 레이아웃과 페이지의 `guardAdminPage()`, 서버 액션의
   * `requireCurator()`, 그리고 RLS. 여기를 true로 바꿔 봐야 404가 나온다.
   */
  isCurator: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * 로그인했으면 true. 아니면 false를 돌려주고 모달을 세운다.
   *
   * 부르는 쪽은 `if (!requireLogin('review')) return;` 한 줄로 끝난다. 판정을
   * 버튼마다 두지 않으려고 여기에 모았다 — 원래 BookmarkProvider.toggle()에
   * 있던 것을, 로그인이 필요한 자리가 셋(북마크·리뷰·제보)이 되면서 올렸다.
   *
   * 세션 판정 전에는 false를 돌려주되 모달도 띄우지 않는다. 그 짧은 사이의 클릭은
   * 조용히 무시되며, 잘못된 안내를 보여주는 것보다 낫다.
   */
  requireLogin: (reason: LoginReason) => boolean;
  /** 지금 띄워야 하는 로그인 안내. 없으면 null */
  loginPrompt: LoginReason | null;
  dismissLoginPrompt: () => void;
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
  const [loginPrompt, setLoginPrompt] = useState<LoginReason | null>(null);
  /**
   * 큐레이터로 확인된 사람의 uid. boolean이 아니라 **주인을 같이 든다.**
   *
   * boolean으로 들고 로그아웃 때 effect로 내리면, A가 나가고 B가 들어온 순간
   * B에게 A의 권한 표시가 잠깐 비친다. 주인을 들고 렌더 중에 맞춰 보면 그 틈이
   * 없다 — `BookmarkProvider`가 북마크 목록에 쓰는 것과 같은 방법이다.
   */
  const [curatorId, setCuratorId] = useState<string | null>(null);

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

  /**
   * 역할 조회. 세션이 정해진 뒤에 한 번 돈다.
   *
   * `profiles_select_own_or_curator` 정책이 **본인 행만** 열어 준다. 결과는
   * "dock에 입구를 그릴까"에만 쓴다.
   *
   * ⚠️ `if (!user) return;`이 이 정책의 전제다. 2026-08-23 전까지 정책이
   *    `to anon using (true)`였고, 그때는 로그아웃 상태로도 남의 행이 읽혔다
   *    (docs/security-audit-2026-08-23/README.md — H1). 로그아웃 상태에서 이
   *    조회를 돌리려 하면 지금은 빈 결과가 온다.
   */
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    getBrowserSupabase()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>()
      .then(({ data }) => {
        if (cancelled) return;
        const curator = data?.role === 'curator' || data?.role === 'admin';
        setCuratorId(curator ? user.id : null);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const requireLogin = useCallback(
    (reason: LoginReason) => {
      // 판정 전에는 아무 일도 하지 않는다. 여기서 모달을 띄우면 이미 로그인한
      // 사람이 세션 복구 중에 누른 순간 "로그인이 필요해요"를 보게 된다 —
      // dock의 제보 버튼과 리뷰 chip은 AuthDock과 달리 첫 페인트부터 떠 있다.
      if (!resolved) return false;
      if (user) return true;
      setLoginPrompt(reason);
      return false;
    },
    [resolved, user],
  );

  const dismissLoginPrompt = useCallback(() => setLoginPrompt(null), []);

  // 렌더 중에 맞춰 본다. 로그아웃하거나 다른 사람이 들어오면 그 순간 false가 된다.
  const isCurator = user !== null && curatorId === user.id;

  const value = useMemo<AuthState>(
    () => ({
      user,
      resolved,
      isCurator,
      error,
      signIn,
      signOut,
      requireLogin,
      loginPrompt,
      dismissLoginPrompt,
    }),
    [user, resolved, isCurator, error, signIn, signOut, requireLogin, loginPrompt, dismissLoginPrompt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
