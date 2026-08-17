'use client';

import type { Cafe } from '@/types/cafe';
import { useBookmarks } from './BookmarkProvider';

/**
 * 상세 패널의 하트 (DESIGN.md — Detail Panel).
 *
 * 로그인 여부를 여기서 보지 않는다. 누르면 무조건 toggle에 넘기고, 로그인이
 * 없으면 BookmarkProvider가 모달로 돌린다. 로그아웃 상태에서도 버튼을 숨기지
 * 않는 것이 이 화면의 결정이다 — 저장할 수 있다는 사실 자체가 로그인의 이유다.
 */
export default function BookmarkButton({ cafe }: { cafe: Cafe }) {
  const { isBookmarked, toggle } = useBookmarks();
  const saved = isBookmarked(cafe.id);

  return (
    <button
      type="button"
      className={`bookmark-button${saved ? ' bookmark-button--on' : ''}`}
      onClick={() => toggle(cafe)}
      aria-pressed={saved}
      aria-label={saved ? `${cafe.name} 북마크 해제` : `${cafe.name} 북마크`}
      title={saved ? '북마크 해제' : '북마크'}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

/**
 * 저장 전에는 선만, 저장 후에는 채운다. 크기나 위치는 그대로 두고 채움만
 * 바뀌게 해서 눌렀을 때 레이아웃이 흔들리지 않게 한다.
 */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 16.5c-.3 0-.6-.1-.8-.3C6 13.4 3 10.9 3 7.9 3 5.7 4.7 4 6.8 4c1.3 0 2.5.6 3.2 1.6C10.7 4.6 11.9 4 13.2 4 15.3 4 17 5.7 17 7.9c0 3-3 5.5-6.2 8.3-.2.2-.5.3-.8.3z" />
    </svg>
  );
}
