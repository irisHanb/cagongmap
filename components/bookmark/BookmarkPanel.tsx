'use client';

import type { Cafe } from '@/types/cafe';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBookmarks } from './BookmarkProvider';

/**
 * dock의 북마크 패널 (DESIGN.md — Left Panel 6번, Bookmark Panel).
 *
 * 로그인 후에만 나온다. 로그아웃 상태에서 저장으로 들어가는 입구는 상세의 하트
 * 하나뿐이다 — dock에까지 로그인 유도를 두 개 두지 않는다.
 *
 * 목록은 후보 리스트의 대체물이 아니다. 사진 카드로 키우지 않고 이름과 주소만
 * 한 줄씩 놓는다.
 */
export default function BookmarkPanel({ onSelect }: { onSelect: (cafe: Cafe) => void }) {
  const { user, resolved: authResolved } = useAuth();
  const { cafes, resolved, error } = useBookmarks();

  if (!authResolved || !user) return null;

  return (
    <section className="bookmark-panel" aria-label="내 북마크">
      <p className="eyebrow">BOOKMARKS</p>
      <h2 className="bookmark-panel__title">
        내 북마크
        {/* 조회가 끝나기 전에는 개수를 말하지 않는다. 0을 보여줬다가 숫자가
            바뀌면 저장한 적 없다고 잘못 읽힌다. */}
        {resolved && <span className="bookmark-panel__count">{cafes.length}</span>}
      </h2>

      {error && <p className="bookmark-panel__empty">{error}</p>}

      {resolved && !error && cafes.length === 0 && (
        <p className="bookmark-panel__empty">지도에서 카페를 열고 하트를 눌러 저장하세요</p>
      )}

      {cafes.length > 0 && (
        <ul className="bookmark-list">
          {cafes.map((cafe) => (
            <li key={cafe.id}>
              <button type="button" className="bookmark-list__item" onClick={() => onSelect(cafe)}>
                <span className="bookmark-list__name">{cafe.name}</span>
                <span className="bookmark-list__address">{cafe.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
