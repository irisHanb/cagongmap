import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import CafeCard from '@/components/cafe/CafeCard';
import AuthProvider from '@/components/auth/AuthProvider';
import BookmarkProvider from '@/components/bookmark/BookmarkProvider';
import { makeCafe } from '@/test/fixtures';

/**
 * 상세 패널 렌더 테스트.
 *
 * CafeCard는 BookmarkButton → BookmarkProvider → AuthProvider로 이어지므로 세션이
 * 필요하다. 그 뿌리인 supabase-browser 하나만 가짜로 바꾸면 나머지는 실제 코드가
 * 그대로 돈다 — 로그아웃 상태의 화면을 있는 그대로 확인하는 셈이다.
 *
 * 로그아웃 상태에서는 BookmarkProvider가 북마크를 조회하지 않으므로
 * lib/bookmarks는 따로 막지 않아도 네트워크를 타지 않는다.
 */
vi.mock('@/lib/supabase-browser', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  }),
}));

function renderCard(ui: ReactElement) {
  return render(
    <AuthProvider>
      <BookmarkProvider>{ui}</BookmarkProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  // isOpenNow가 실제 시각을 읽으므로 고정한다. 안 그러면 "영업중" 단정이
  // 테스트를 돌린 시각에 따라 뒤집힌다.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 17, 15, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CafeCard', () => {
  it('이름과 주소, 확인일을 보여준다', async () => {
    renderCard(<CafeCard cafe={makeCafe()} onClose={() => {}} />);

    expect(await screen.findByRole('heading', { name: '나루터' })).toBeInTheDocument();
    expect(screen.getByText('서울 송파구 백제고분로 000')).toBeInTheDocument();
    // 데이터 신선도 노출은 구속력 있는 결정이다 (docs/mvp-decisions.md 2-3)
    expect(screen.getByText('2026-08-15 확인')).toBeInTheDocument();
  });

  it('Quick Check 다섯 항목을 모두 보여준다', async () => {
    renderCard(<CafeCard cafe={makeCafe()} onClose={() => {}} />);

    await screen.findByRole('heading', { name: '나루터' });
    for (const label of ['콘센트', '소음', '와이파이', '아메리카노', '영업시간']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('콘센트 많음')).toBeInTheDocument();
    expect(screen.getByText('조용함')).toBeInTheDocument();
    expect(screen.getByText('있음')).toBeInTheDocument();
    expect(screen.getByText('4,500원')).toBeInTheDocument();
  });

  it('영업시간 항목이 고정된 현재 시각으로 영업 여부를 말한다', async () => {
    // 15:00이므로 09:00~22:00은 영업중이다.
    renderCard(<CafeCard cafe={makeCafe()} onClose={() => {}} />);
    expect(await screen.findByText('영업중 · 09:00 - 22:00')).toBeInTheDocument();
  });

  it('영업이 끝난 카페는 영업종료로 적는다', async () => {
    const cafe = makeCafe({ open_time: '07:00', close_time: '11:00' });
    renderCard(<CafeCard cafe={cafe} onClose={() => {}} />);
    expect(await screen.findByText('영업종료 · 07:00 - 11:00')).toBeInTheDocument();
  });

  it('가격을 확인하지 못한 카페는 0원이 아니라 확인 안 됨으로 적는다', async () => {
    renderCard(<CafeCard cafe={makeCafe({ iced_americano_price: null })} onClose={() => {}} />);
    expect(await screen.findByText('확인 안 됨')).toBeInTheDocument();
  });

  it('사진이 없으면 자리를 없애지 않고 빈 상태를 보여준다', async () => {
    renderCard(<CafeCard cafe={makeCafe({ photos: [] })} onClose={() => {}} />);
    expect(await screen.findByText('등록된 사진이 없습니다')).toBeInTheDocument();
  });

  it('지도 링크는 naver_place_url이 있을 때만 나온다', async () => {
    const { unmount } = renderCard(<CafeCard cafe={makeCafe()} onClose={() => {}} />);
    await screen.findByRole('heading', { name: '나루터' });
    expect(screen.queryByRole('link', { name: /지도에서 보기/ })).not.toBeInTheDocument();
    unmount();

    const cafe = makeCafe({ naver_place_url: 'https://map.naver.com/p/entry/place/123' });
    renderCard(<CafeCard cafe={cafe} onClose={() => {}} />);
    const link = await screen.findByRole('link', { name: /지도에서 보기/ });
    expect(link).toHaveAttribute('href', 'https://map.naver.com/p/entry/place/123');
  });

  it('태그를 힌트로 보여주고, 없으면 목록 자체를 그리지 않는다', async () => {
    const { unmount } = renderCard(
      <CafeCard cafe={makeCafe({ tags: ['창가석', '넓은 테이블'] })} onClose={() => {}} />,
    );
    expect(await screen.findByText('창가석')).toBeInTheDocument();
    expect(screen.getByText('넓은 테이블')).toBeInTheDocument();
    unmount();

    renderCard(<CafeCard cafe={makeCafe({ tags: [] })} onClose={() => {}} />);
    await screen.findByRole('heading', { name: '나루터' });
    expect(screen.queryByText('창가석')).not.toBeInTheDocument();
  });

  it('로그아웃 상태에서도 북마크 하트를 감추지 않는다', async () => {
    // DESIGN.md에서 뒤집은 규칙이다 — 저장할 수 있다는 사실 자체가 로그인의 이유다.
    renderCard(<CafeCard cafe={makeCafe()} onClose={() => {}} />);

    const heart = await screen.findByRole('button', { name: '나루터 북마크' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
  });

  it('닫기 버튼이 onClose를 부른다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    renderCard(<CafeCard cafe={makeCafe()} onClose={onClose} />);

    await user.click(await screen.findByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
