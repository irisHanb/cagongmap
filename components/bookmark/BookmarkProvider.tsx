'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Cafe } from '@/types/cafe';
import { addBookmark, getBookmarkedCafes, removeBookmark } from '@/lib/bookmarks';
import { useAuth } from '@/components/auth/AuthProvider';

/**
 * 북마크 상태.
 *
 * 저장된 카페 목록 하나만 들고, "저장됐는가"와 개수는 거기서 파생시킨다.
 * id Set과 목록을 따로 들면 둘이 어긋나는 순간이 반드시 온다.
 *
 * 로그인하지 않은 사람이 하트를 누르면 여기서 걸러 모달을 띄운다. 판정을 버튼마다
 * 두지 않고 한 곳에 모은 이유는, 나중에 북마크를 누르는 자리가 늘어도 규칙이
 * 한 군데에만 있게 하려는 것이다.
 */
interface BookmarkState {
  cafes: Cafe[];
  /** 첫 조회가 끝났는가. 끝나기 전에는 패널이 개수를 말하지 않는다 */
  resolved: boolean;
  error: string | null;
  isBookmarked: (cafeId: string) => boolean;
  toggle: (cafe: Cafe) => void;
  /** 로그인 없이 저장을 시도했는가 — 모달을 띄우는 신호 */
  loginPrompt: boolean;
  dismissLoginPrompt: () => void;
}

const BookmarkContext = createContext<BookmarkState | null>(null);

export function useBookmarks(): BookmarkState {
  const value = useContext(BookmarkContext);
  if (!value) {
    throw new Error('useBookmarks는 BookmarkProvider 안에서만 쓸 수 있습니다');
  }
  return value;
}

/**
 * 조회 결과에 주인을 붙여서 들고 있는다.
 *
 * 목록만 들고 로그아웃 때 비우는 방식으로 하면, 그 비우는 일을 effect가 해야 한다.
 * 주인을 같이 들면 "지금 사용자 것이 아니면 없는 것"으로 렌더 중에 판정할 수 있다.
 * A가 로그아웃하고 B가 들어왔을 때 B에게 A의 목록이 잠깐 비치는 일도 여기서 막힌다.
 */
interface Loaded {
  userId: string;
  cafes: Cafe[];
  error: string | null;
}

export default function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user, resolved: authResolved } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);

  useEffect(() => {
    if (!authResolved || !user) return;

    const userId = user.id;
    let cancelled = false;

    getBookmarkedCafes()
      .then((cafes) => {
        if (!cancelled) setLoaded({ userId, cafes, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setLoaded({ userId, cafes: [], error: e.message });
      });

    // 사용자가 바뀌면 이전 조회 결과를 버린다. 늦게 도착한 응답이
    // 새 사용자의 목록을 덮어쓰지 않게.
    return () => {
      cancelled = true;
    };
  }, [user, authResolved]);

  // 지금 사용자 것일 때만 유효하다. 로그아웃 상태에서는 볼 것이 없다.
  const current = user && loaded?.userId === user.id ? loaded : null;
  const resolved = authResolved && (!user || current !== null);
  const error = current?.error ?? null;

  // useMemo로 감싸야 로그아웃 상태에서 렌더마다 새 빈 배열이 나오지 않는다.
  // 그대로 두면 아래 useCallback·useMemo가 매번 다시 만들어진다.
  const cafes = useMemo(() => current?.cafes ?? [], [current]);

  const isBookmarked = useCallback(
    (cafeId: string) => cafes.some((cafe) => cafe.id === cafeId),
    [cafes],
  );

  const toggle = useCallback(
    (cafe: Cafe) => {
      if (!user) {
        setLoginPrompt(true);
        return;
      }

      const userId = user.id;
      const saved = cafes.some((c) => c.id === cafe.id);

      // 낙관적으로 먼저 반영한다. 하트는 누른 즉시 반응해야 하고,
      // 실패하면 아래 catch가 되돌린다.
      const apply = (next: (list: Cafe[]) => Cafe[], nextError: string | null) =>
        setLoaded((prev) =>
          prev && prev.userId === userId
            ? { userId, cafes: next(prev.cafes), error: nextError }
            : prev,
        );

      apply((list) => (saved ? list.filter((c) => c.id !== cafe.id) : [cafe, ...list]), null);

      const request = saved ? removeBookmark(cafe.id) : addBookmark(cafe.id);
      request.catch((e: Error) => {
        apply((list) => (saved ? [cafe, ...list] : list.filter((c) => c.id !== cafe.id)), e.message);
      });
    },
    [user, cafes],
  );

  const dismissLoginPrompt = useCallback(() => setLoginPrompt(false), []);

  const value = useMemo<BookmarkState>(
    () => ({ cafes, resolved, error, isBookmarked, toggle, loginPrompt, dismissLoginPrompt }),
    [cafes, resolved, error, isBookmarked, toggle, loginPrompt, dismissLoginPrompt],
  );

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}
