'use client';

import { useEffect, useRef, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import {
  applyToCounts,
  clearReview,
  formatCounts,
  getMyReview,
  getReviewCounts,
  REVIEW_LABEL,
  REVIEW_VALUES,
  setReview,
  type ReviewCounts,
  type ReviewValue,
} from '@/lib/reviews';
import { useAuth } from '@/components/auth/AuthProvider';

/**
 * 상세 패널의 리뷰 (DESIGN.md — Detail Panel 7번).
 *
 * 상태를 provider로 빼지 않았다. 리뷰를 보는 곳이 이 화면 하나뿐이고, CafeCard가
 * 카페마다 key로 새로 마운트되므로 카페가 바뀌면 상태도 저절로 초기화된다.
 * 소비자가 하나뿐인 context는 규칙이 아니라 겹이다.
 *
 * 로그인 판정은 여기 없다 — AuthProvider의 requireLogin이 한다. 로그아웃
 * 상태에서도 버튼은 보이고, 누르면 저장 대신 모달이 뜬다 (상세 하트와 같은 규칙).
 */
export default function ReviewSection({ cafe }: { cafe: Cafe }) {
  const { user, resolved: authResolved, requireLogin } = useAuth();

  /** null이면 아직 조회 중이다. 0을 먼저 띄우면 평가가 없다고 잘못 읽힌다. */
  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  /**
   * 내 평가는 주인을 같이 들고 렌더 중에 판정한다. 목록만 들고 로그아웃 때
   * 비우면 그 일을 effect가 해야 하고, A가 나가고 B가 들어온 순간 B에게 A의
   * 평가가 잠깐 비친다 (BookmarkProvider와 같은 이유).
   */
  const [loaded, setLoaded] = useState<{ userId: string; value: ReviewValue | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * 한 번이라도 눌렀는가.
   *
   * 첫 조회가 클릭보다 늦게 도착하면 낙관적으로 바꿔 둔 값을 옛 값으로 되돌려 버린다.
   * effect의 의존성(cafe.id·user·authResolved)은 클릭으로 바뀌지 않으므로 cleanup의
   * cancelled로는 막지 못한다. 누른 뒤로는 서버가 답을 줘도 화면을 되돌리지 않고,
   * 대신 요청이 끝난 뒤 집계를 다시 받아 맞춘다.
   */
  const touched = useRef(false);

  const mine = user && loaded?.userId === user.id ? loaded.value : null;

  // 집계는 로그인과 무관하다. 로그아웃 상태에서도 보여야 하므로 따로 가져온다.
  useEffect(() => {
    let cancelled = false;

    getReviewCounts(cafe.id)
      .then((next) => {
        if (!cancelled && !touched.current) setCounts(next);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [cafe.id]);

  useEffect(() => {
    if (!authResolved || !user) return;

    const userId = user.id;
    let cancelled = false;

    getMyReview(cafe.id)
      .then((value) => {
        if (!cancelled && !touched.current) setLoaded({ userId, value });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    // 사용자가 바뀌면 이전 조회 결과를 버린다. 늦게 도착한 응답이 새 사용자의
    // 평가를 덮어쓰지 않게.
    return () => {
      cancelled = true;
    };
  }, [cafe.id, user, authResolved]);

  const choose = (value: ReviewValue) => {
    if (!requireLogin('review') || !user) return;

    const userId = user.id;
    const before = mine;
    // 같은 값을 다시 누르면 해제다.
    const after = before === value ? null : value;

    // 낙관적으로 먼저 반영한다. 누른 즉시 반응해야 하고, 실패하면 되돌린다.
    touched.current = true;
    setError(null);
    setLoaded({ userId, value: after });
    setCounts((prev) => (prev ? applyToCounts(prev, before, after) : prev));

    const request = after ? setReview(cafe.id, after) : clearReview(cafe.id);
    request
      .then(() => {
        // 서버 집계로 맞춘다. 내 평가를 아직 못 받은 채 눌렀다면 before가 null이라
        // 낙관적 증감이 한쪽으로 치우쳐 있을 수 있다 — 그 어긋남이 여기서 사라진다.
        getReviewCounts(cafe.id)
          .then(setCounts)
          .catch(() => {
            // 집계를 다시 못 받아도 화면은 낙관적 값으로 돌아간다. 조용히 둔다.
          });
      })
      .catch((e: Error) => {
        setLoaded((prev) => (prev?.userId === userId ? { userId, value: before } : prev));
        setCounts((prev) => (prev ? applyToCounts(prev, after, before) : prev));
        setError(e.message);
      });
  };

  return (
    <section className="review">
      <h3 className="eyebrow">REVIEW</h3>

      <ul className="review__choices">
        {REVIEW_VALUES.map((value) => {
          const on = mine === value;
          return (
            <li key={value}>
              <button
                type="button"
                className={`review-chip review-chip--${value}${on ? ' review-chip--on' : ''}`}
                onClick={() => choose(value)}
                aria-pressed={on}
              >
                {REVIEW_LABEL[value]}
              </button>
            </li>
          );
        })}
      </ul>

      {/* 조회 전에는 숫자를 말하지 않되 줄은 비워둔다. 나중에 끼어들면서
          아래 내용을 밀어내지 않게 하려는 것이다. */}
      <p className="review__counts">{counts ? formatCounts(counts) : ' '}</p>

      {/* 실패에 색을 주지 않는다 — 색이 드는 것은 좋은 조건뿐이다 (DESIGN.md) */}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
