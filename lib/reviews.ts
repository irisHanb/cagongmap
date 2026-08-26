import { resolvePlaceId } from '@/lib/place-id';
import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * ★ 리뷰 데이터 접근 계층
 *
 * lib/cafes.ts · lib/bookmarks.ts와 같은 규칙이다. 컴포넌트는 place_reviews를
 * 직접 건드리지 않는다. 세션이 있어야 RLS를 통과하므로 **브라우저 전용**이다.
 *
 * 읽는 경로가 둘로 갈린다. 이유가 있다.
 *
 *  - 내 평가: place_reviews를 직접 select한다. RLS가 본인 행만 돌려준다.
 *  - 집계:    place_review_counts() RPC. 테이블을 직접 열면 누가 어디에 bad를
 *             눌렀는지 통째로 보이기 때문에, 남에게 보여줄 숫자는 이 함수만
 *             내놓는다. 로그아웃 상태에서도 부를 수 있다.
 */

export type ReviewValue = 'good' | 'normal' | 'bad';

export interface ReviewCounts {
  good: number;
  normal: number;
  bad: number;
}

export const REVIEW_VALUES: ReviewValue[] = ['good', 'normal', 'bad'];

/**
 * chip에는 이모지만 그리고 이 말은 aria-label로만 남는다. 화면에서 사라져도
 * 스크린리더와 테스트는 여전히 `좋아요`로 버튼을 부른다.
 */
export const REVIEW_LABEL: Record<ReviewValue, string> = {
  good: '좋아요',
  normal: '보통',
  bad: '별로',
};

/** 표정 셋으로 맞춘다. 세 값이 같은 종류로 읽혀야 눈이 비교한다. */
export const REVIEW_EMOJI: Record<ReviewValue, string> = {
  good: '😊',
  normal: '😐',
  bad: '😕',
};

export const EMPTY_COUNTS: ReviewCounts = { good: 0, normal: 0, bad: 0 };

export function totalReviews(counts: ReviewCounts): number {
  return counts.good + counts.normal + counts.bad;
}

/**
 * chip 아래 한 줄. 값별 숫자는 chip이 이미 이모지 옆에 들고 있으므로 여기서는
 * 합계만 말한다.
 *
 * 0건이면 `전체 0개` 대신 유도 문구를 돌려준다. 0은 정보가 아니라 소음이고,
 * 카페 9곳 대부분이 그 상태다.
 */
export function formatTotal(counts: ReviewCounts): string {
  const total = totalReviews(counts);
  if (total === 0) {
    return '아직 평가가 없어요. 첫 평가를 남겨보세요';
  }

  return `전체 ${total}개`;
}

/** 낙관적 갱신용. 요청을 기다리지 않고 화면의 집계를 먼저 옮긴다. */
export function applyToCounts(
  counts: ReviewCounts,
  before: ReviewValue | null,
  after: ReviewValue | null,
): ReviewCounts {
  if (before === after) return counts;

  const next = { ...counts };
  if (before) next[before] = Math.max(0, next[before] - 1);
  if (after) next[after] += 1;
  return next;
}

interface CountsRow {
  good: number;
  normal: number;
  bad: number;
}

export async function getReviewCounts(cafeId: string): Promise<ReviewCounts> {
  const { data, error } = await getBrowserSupabase().rpc('place_review_counts', {
    p_place_id: await resolvePlaceId(cafeId),
  });

  if (error) {
    throw new Error(`평가를 불러오지 못했습니다: ${error.message}`);
  }

  // DB 타입을 생성해 쓰지 않으므로 rpc 결과는 추론되지 않는다. 함수가
  // returns table(...)이라 행이 하나 담긴 배열로 오고, 평가가 없는 장소도
  // count(*)라 0 한 행이 나온다. 그래도 빈 배열을 방어적으로 받아 둔다.
  const rows = (data ?? []) as CountsRow[];
  return rows[0] ?? EMPTY_COUNTS;
}

/**
 * 내가 이 카페에 남긴 평가. 없으면 null.
 *
 * RLS가 본인 행만 돌려주므로 where user_id = ... 를 쓰지 않는다. 조건을 한 번 더
 * 적으면 정책이 느슨해져도 화면이 멀쩡해 보여서 오히려 문제를 가린다.
 */
export async function getMyReview(cafeId: string): Promise<ReviewValue | null> {
  const { data, error } = await getBrowserSupabase()
    .from('place_reviews')
    .select('value')
    .eq('place_id', await resolvePlaceId(cafeId))
    .maybeSingle<{ value: ReviewValue }>();

  if (error) {
    throw new Error(`평가를 불러오지 못했습니다: ${error.message}`);
  }

  return data?.value ?? null;
}

/**
 * 평가를 남기거나 바꾼다.
 *
 * upsert 한 번으로 끝낸다. 있으면 update, 없으면 insert를 따로 부르면 그 사이에
 * 같은 사람이 다른 탭에서 누른 경우 PK 충돌이 난다. onConflict는 PK 그대로다.
 *
 * user_id는 넣지 않는다. 컬럼 default가 auth.uid()이고, 값을 실어 보내면
 * with check가 검사할 거리를 우리가 만들어 주는 셈이다.
 */
export async function setReview(cafeId: string, value: ReviewValue): Promise<void> {
  const { error } = await getBrowserSupabase()
    .from('place_reviews')
    .upsert({ place_id: await resolvePlaceId(cafeId), value }, { onConflict: 'user_id,place_id' });

  if (error) {
    throw new Error(`평가를 남기지 못했습니다: ${error.message}`);
  }
}

/** 같은 값을 다시 누르면 해제다. 상태 컬럼이 아니라 delete로 지운다. */
export async function clearReview(cafeId: string): Promise<void> {
  const { error } = await getBrowserSupabase()
    .from('place_reviews')
    .delete()
    .eq('place_id', await resolvePlaceId(cafeId));

  if (error) {
    throw new Error(`평가를 지우지 못했습니다: ${error.message}`);
  }
}
