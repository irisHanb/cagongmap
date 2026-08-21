import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type SubmissionStatus } from '@/lib/admin/submission';

/**
 * 검수 상태 배지.
 *
 * ⚠️ **반려에 빨강을 주지 않는다.** "부정 상태에는 색을 주지 않는다. 색이 드는 것은
 * 좋은 조건뿐이다"가 DESIGN.md의 규칙이고 관리자 화면도 예외가 아니다.
 *
 *  - 대기: `primary` — 아직 할 일이라 눈에 띄어야 한다
 *  - 승인: `pastel-mint` — Quick Check의 좋은 조건과 같은 색이다
 *  - 반려: 무채색
 *
 * `Badge`에 애초에 `destructive` variant를 두지 않았으므로, 여기서 실수로 빨강을
 * 고를 방법도 없다.
 */
const VARIANT = {
  pending: 'default',
  approved: 'positive',
  rejected: 'secondary',
} as const;

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
