import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CafeListPanel from '@/components/cafe/CafeListPanel';
import AuthProvider from '@/components/auth/AuthProvider';
import BookmarkProvider from '@/components/bookmark/BookmarkProvider';
import { makeCafe } from '@/test/fixtures';

/**
 * dock 전체 목록 렌더 테스트.
 *
 * BookmarkButton이 들어 있어 세션이 필요하다. 뿌리인 supabase-browser 하나만 가짜로
 * 바꾸는 방식은 CafeCard.test.tsx와 같다.
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

function renderPanel({
  cafes = [makeCafe()],
  onSelect = vi.fn(),
  query = '',
  onQueryChange = vi.fn(),
} = {}) {
  render(
    <AuthProvider>
      <BookmarkProvider>
        <CafeListPanel
          cafes={cafes}
          query={query}
          onQueryChange={onQueryChange}
          onSelect={onSelect}
        />
      </BookmarkProvider>
    </AuthProvider>,
  );
  return { onSelect, onQueryChange };
}

describe('CafeListPanel', () => {
  it('카페마다 이름·주소와 chip 셋을 보여준다', () => {
    renderPanel({ cafes: [makeCafe({ outlet: 'some', noise: 'normal' })] });

    expect(screen.getByText('나루터')).toBeInTheDocument();
    expect(screen.getByText('서울 송파구 백제고분로 000')).toBeInTheDocument();
    expect(screen.getByText('콘센트 보통')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 22:00')).toBeInTheDocument();
    expect(screen.getByText('보통')).toBeInTheDocument();
  });

  /**
   * aria-label이 없으면 span 넷이 띄어쓰기 없이 이어 붙어
   * "나루터서울 송파구 000콘센트 많음..."으로 읽힌다. 값 사이가 끊어지는지 본다.
   */
  it('카드 버튼이 이름·주소·chip을 끊어 읽어 준다', () => {
    renderPanel();

    expect(
      screen.getByRole('button', {
        name: '나루터, 서울 송파구 백제고분로 000, 콘센트 많음, 09:00 - 22:00, 조용함',
      }),
    ).toBeInTheDocument();
  });

  it('카드를 누르면 그 카페를 넘긴다', async () => {
    const cafe = makeCafe();
    const { onSelect } = renderPanel({ cafes: [cafe] });

    await userEvent.click(screen.getByRole('button', { name: /^나루터, 서울 송파구/ }));

    expect(onSelect).toHaveBeenCalledWith(cafe);
  });

  /**
   * 하트는 카드 버튼 안이 아니라 형제다. 안에 넣으면 button 중첩이라 렌더되지 않고,
   * 겹쳐 두기만 하고 형제로 두지 않으면 하트를 누를 때 상세까지 함께 열린다.
   */
  it('하트를 눌러도 상세가 열리지 않는다', async () => {
    const { onSelect } = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: '나루터 북마크' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('검색 입력칸이 접근 가능한 이름과 placeholder를 갖고 렌더된다 (AC1·AC8)', () => {
    renderPanel();

    const searchbox = screen.getByRole('searchbox', { name: '카페 검색' });
    expect(searchbox).toBeInTheDocument();
    expect(searchbox).toHaveAttribute('placeholder', '동네나 카페 이름');
  });

  it('입력값을 그대로 onQueryChange로 넘긴다', async () => {
    const { onQueryChange } = renderPanel();

    // 컨트롤드 입력이라 query prop이 고정되어 있으면 매 타이핑이 그 값을 되돌린다
    // (실제 화면에서는 MapShell이 onQueryChange를 받아 query를 갱신한다). 여기서는
    // "입력한 값이 그대로 콜백에 전달되는지"만 한 글자로 확인한다.
    await userEvent.type(screen.getByRole('searchbox', { name: '카페 검색' }), '나');

    expect(onQueryChange).toHaveBeenCalledWith('나');
  });

  it('걸러진 카페가 0곳이면 카드 대신 한 줄 문구를 보여준다 (AC5)', () => {
    renderPanel({ cafes: [], query: 'zzzz' });

    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
