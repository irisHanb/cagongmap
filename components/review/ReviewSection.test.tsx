import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewSection from '@/components/review/ReviewSection';
import AuthProvider, { useAuth } from '@/components/auth/AuthProvider';
import { makeCafe } from '@/test/fixtures';

/**
 * 리뷰 섹션.
 *
 * CLAUDE.md의 규칙대로 @/lib/supabase-browser 하나만 가짜로 바꾼다. lib/reviews와
 * AuthProvider는 실제 코드가 그대로 돌아서, 낙관적 갱신과 로그인 유도가 진짜
 * 경로를 지나간다.
 */

interface State {
  userId: string | null;
  counts: { good: number; normal: number; bad: number };
  mine: string | null;
  fail: boolean;
  /** 내 평가 조회를 늦춘다 — 클릭이 먼저 일어나는 상황을 만들기 위한 것 */
  mineDelayMs: number;
}

const state: State = {
  userId: null,
  counts: { good: 0, normal: 0, bad: 0 },
  mine: null,
  fail: false,
  mineDelayMs: 0,
};
const calls: string[] = [];

/**
 * 가짜 서버의 저장 규칙. 화면이 낙관적으로 계산한 값과 **따로** 움직여야
 * "요청이 끝난 뒤 서버 집계로 맞춘다"를 검증할 수 있다.
 */
function applyOnServer(next: string | null) {
  if (state.mine) {
    state.counts[state.mine as 'good' | 'normal' | 'bad'] -= 1;
  }
  state.mine = next;
  if (next) {
    state.counts[next as 'good' | 'normal' | 'bad'] += 1;
  }
}

/**
 * supabase-js의 쿼리 빌더는 체이닝 끝에서 await된다(thenable). 그 모양만
 * 흉내 낸다 — 어떤 메서드를 불러도 자기 자신을 돌려주고, await하면 결과를 낸다.
 */
function builder(result: () => { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    maybeSingle: async () => result(),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  return self;
}

vi.mock('@/lib/supabase-browser', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
        error: null,
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async () => ({ data: [{ ...state.counts }], error: null }), // 호출 시점 스냅샷
    from: (table: string) => {
      if (table === 'places') {
        return builder(() => ({ data: { id: 'place-uuid' }, error: null }));
      }

      const fail = () => ({ data: null, error: state.fail ? { message: '저장 실패' } : null });
      const self: Record<string, unknown> = {
        select: () => self,
        eq: () => self,
        maybeSingle: async () => {
          // **호출 시점의 값을 찍어 둔다.** 늦게 도착하는 응답은 그 사이에 일어난
          // 쓰기를 모르는 옛 값이다 — 그 상황을 재현하려면 지연 뒤에 현재 상태를
          // 읽으면 안 된다.
          const snapshot = state.mine;
          if (state.mineDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, state.mineDelayMs));
          }
          return { data: snapshot ? { value: snapshot } : null, error: null };
        },
        upsert: (row: { value: string }) => {
          calls.push(`upsert:${row.value}`);
          if (!state.fail) applyOnServer(row.value);
          return { then: (resolve: (v: unknown) => unknown) => resolve(fail()) };
        },
        delete: () => {
          calls.push('delete');
          if (!state.fail) applyOnServer(null);
          return self;
        },
        then: (resolve: (v: unknown) => unknown) => resolve(fail()),
      };
      return self;
    },
  }),
}));

/** loginPrompt는 MapView가 모달로 그린다. 여기서는 값만 드러내 확인한다. */
function LoginPromptProbe() {
  const { loginPrompt } = useAuth();
  return <p>prompt:{loginPrompt ?? 'none'}</p>;
}

/** chip의 숫자. 이모지 옆에 붙어 있어 버튼 이름으로는 안 잡힌다. */
function chipCount(label: string): string {
  return screen.getByRole('button', { name: label }).textContent?.replace(/\P{N}/gu, '') ?? '';
}

function renderSection() {
  return render(
    <AuthProvider>
      <ReviewSection cafe={makeCafe()} />
      <LoginPromptProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  state.userId = null;
  state.counts = { good: 0, normal: 0, bad: 0 };
  state.mine = null;
  state.fail = false;
  state.mineDelayMs = 0;
  calls.length = 0;
});

describe('ReviewSection', () => {
  it('평가가 없으면 0을 나열하지 않고 유도 문구를 보여준다', async () => {
    renderSection();
    expect(await screen.findByText('아직 평가가 없어요. 첫 평가를 남겨보세요')).toBeInTheDocument();
  });

  it('집계가 있으면 chip마다 숫자를 붙이고 합계를 적는다', async () => {
    state.counts = { good: 2, normal: 1, bad: 0 };
    renderSection();

    expect(await screen.findByText('전체 3개')).toBeInTheDocument();
    // bad가 0이어도 감추지 않는다. 좋은 것만 보이면 집계가 아니라 광고가 된다.
    expect(chipCount('좋아요')).toBe('2');
    expect(chipCount('보통')).toBe('1');
    expect(chipCount('별로')).toBe('0');
  });

  it('로그아웃 상태에서도 버튼 셋을 감추지 않는다', async () => {
    renderSection();

    for (const label of ['좋아요', '보통', '별로']) {
      expect(await screen.findByRole('button', { name: label })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('로그아웃 상태에서 누르면 저장하지 않고 로그인 안내를 세운다', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: '좋아요' }));

    expect(calls).toEqual([]);
    expect(screen.getByText('prompt:review')).toBeInTheDocument();
  });

  it('로그인 상태에서 누르면 즉시 선택되고 집계가 하나 는다', async () => {
    state.userId = 'user-1';
    state.counts = { good: 1, normal: 1, bad: 0 };
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: '좋아요' }));

    // 낙관적 갱신이라 요청을 기다리지 않고 화면이 먼저 움직인다.
    expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute('aria-pressed', 'true');
    expect(chipCount('좋아요')).toBe('2');
    expect(screen.getByText('전체 3개')).toBeInTheDocument();
    expect(calls).toEqual(['upsert:good']);

    // 요청이 끝나면 서버 집계로 다시 맞춘다. 같은 값이어야 한다.
    await waitFor(() => expect(state.mine).toBe('good'));
    expect(await screen.findByText('전체 3개')).toBeInTheDocument();
    expect(chipCount('좋아요')).toBe('2');
  });

  it('같은 값을 다시 누르면 해제하고 집계를 되돌린다', async () => {
    state.userId = 'user-1';
    state.mine = 'good';
    state.counts = { good: 1, normal: 0, bad: 0 };
    const user = userEvent.setup();
    renderSection();

    // 내 평가 조회가 끝나야 눌린 상태에서 시작한다.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );

    await user.click(screen.getByRole('button', { name: '좋아요' }));

    expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls).toEqual(['delete']);
    expect(await screen.findByText('아직 평가가 없어요. 첫 평가를 남겨보세요')).toBeInTheDocument();
  });

  it('평가를 바꾸면 한쪽이 줄고 다른 쪽이 는다', async () => {
    state.userId = 'user-1';
    state.mine = 'good';
    state.counts = { good: 1, normal: 1, bad: 0 };
    const user = userEvent.setup();
    renderSection();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );

    await user.click(screen.getByRole('button', { name: '별로' }));

    expect(await screen.findByText('전체 2개')).toBeInTheDocument();
    expect(chipCount('좋아요')).toBe('0');
    expect(chipCount('별로')).toBe('1');
    expect(calls).toEqual(['upsert:bad']);
  });

  it('저장이 실패하면 되돌리고 사유를 보여준다', async () => {
    state.userId = 'user-1';
    state.counts = { good: 0, normal: 0, bad: 0 };
    state.fail = true;
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: '좋아요' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(screen.getByText('평가를 남기지 못했습니다: 저장 실패')).toBeInTheDocument();
  });

  it('내 평가 조회가 늦게 도착해도 방금 누른 것을 덮지 않는다', async () => {
    // 조회가 클릭보다 늦으면 예전 값으로 되돌려 버리던 버그. effect의 의존성은
    // 클릭으로 바뀌지 않으므로 cleanup의 cancelled로는 막지 못한다.
    state.userId = 'user-1';
    state.mine = 'bad';
    state.counts = { good: 0, normal: 0, bad: 1 };
    state.mineDelayMs = 40;
    const user = userEvent.setup();
    renderSection();

    // 조회가 끝나기 전에 누른다.
    await user.click(await screen.findByRole('button', { name: '좋아요' }));
    expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute('aria-pressed', 'true');

    // 늦게 도착한 응답이 지나가도 선택이 유지되고,
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.getByRole('button', { name: '좋아요' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '별로' })).toHaveAttribute('aria-pressed', 'false');

    // 집계도 서버 값과 어긋나지 않는다 (낙관적 계산만 믿으면 bad가 1로 남는다).
    expect(await screen.findByText('전체 1개')).toBeInTheDocument();
    expect(chipCount('좋아요')).toBe('1');
    expect(chipCount('별로')).toBe('0');
  });
});
