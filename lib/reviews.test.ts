import { describe, expect, it } from 'vitest';
import { applyToCounts, formatTotal, totalReviews, type ReviewCounts } from '@/lib/reviews';

/**
 * 순수 함수만 본다. 조회·저장은 Supabase에 붙는 일이라 여기서 검증하지 않고,
 * RLS와 집계 함수는 scripts/verify-schema.sh가 실제 Postgres에서 검사한다.
 */

function counts(overrides: Partial<ReviewCounts> = {}): ReviewCounts {
  return { good: 0, normal: 0, bad: 0, ...overrides };
}

describe('formatTotal', () => {
  it('평가가 하나도 없으면 0을 말하지 않고 유도 문구를 낸다', () => {
    // 카페 9곳 대부분이 이 상태다. "전체 0개"는 정보가 아니다.
    expect(formatTotal(counts())).toBe('아직 평가가 없어요. 첫 평가를 남겨보세요');
  });

  it('하나라도 있으면 셋을 더한 수를 적는다', () => {
    // 값별 숫자는 chip이 이모지 옆에 들고 있다. 이 줄은 합계만 말한다.
    expect(formatTotal(counts({ good: 2, normal: 1 }))).toBe('전체 3개');
  });
});

describe('totalReviews', () => {
  it('셋을 더한다', () => {
    expect(totalReviews(counts({ good: 2, normal: 1, bad: 3 }))).toBe(6);
  });
});

describe('applyToCounts', () => {
  it('처음 평가하면 그 값이 하나 는다', () => {
    expect(applyToCounts(counts(), null, 'good')).toEqual(counts({ good: 1 }));
  });

  it('평가를 바꾸면 한쪽이 줄고 다른 쪽이 는다', () => {
    const before = counts({ good: 1, bad: 2 });
    expect(applyToCounts(before, 'good', 'bad')).toEqual(counts({ good: 0, bad: 3 }));
  });

  it('해제하면 그 값이 하나 준다', () => {
    expect(applyToCounts(counts({ normal: 2 }), 'normal', null)).toEqual(counts({ normal: 1 }));
  });

  it('같은 값이면 그대로 둔다', () => {
    const before = counts({ good: 1 });
    expect(applyToCounts(before, 'good', 'good')).toBe(before);
  });

  it('되돌릴 때 음수로 내려가지 않는다', () => {
    // 실패해서 되돌리는 경로가 두 번 겹치면 0에서 -1이 될 수 있다.
    // 화면에 "좋아요 -1"이 뜨는 것보다 0에서 멈추는 편이 낫다.
    expect(applyToCounts(counts(), 'good', null)).toEqual(counts());
  });

  it('원본을 건드리지 않는다', () => {
    const before = counts({ good: 1 });
    applyToCounts(before, 'good', 'bad');
    expect(before).toEqual(counts({ good: 1 }));
  });
});
