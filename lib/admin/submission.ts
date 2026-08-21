/**
 * 제보 검수의 **타입과 라벨**. 조회는 여기 없다.
 *
 * `lib/admin/reports.ts`에서 갈라 나온 파일이다. 그쪽은 `lib/supabase-server.ts`를
 * 거쳐 `next/headers`에 닿으므로 **클라이언트 컴포넌트가 import할 수 없다.** 표와
 * dialog가 상태 라벨과 행 타입을 알아야 하는데, 그 하나 때문에 서버 모듈을 끌고
 * 들어가면 빌드가 깨진다.
 *
 * 값을 담는 쪽(라벨·필터 목록)과 조회하는 쪽을 가르는 기준은 그것 하나다 —
 * **브라우저가 알아도 되는가.**
 */

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
};

/** 목록 필터. `all`은 상태를 묻지 않는다 */
export type StatusFilter = SubmissionStatus | 'all';

export const STATUS_FILTERS: StatusFilter[] = ['pending', 'approved', 'rejected', 'all'];

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter) ? (value as StatusFilter) : 'pending';
}

export type SubmissionKind = 'report' | 'edit';

/**
 * 두 테이블(`place_reports`, `place_edit_requests`)을 화면에서 같은 모양으로 다룬다.
 *
 * 담는 정보가 달라 테이블을 갈랐지만(20260820115447), 검수하는 사람이 보는 것
 * — 사진·메모·누가·언제 — 은 같다. 갈리는 것은 "무엇을 가리키는가" 하나뿐이라
 * `naverPlaceUrl`과 `place` 두 칸으로 흡수된다.
 */
export interface SubmissionItem {
  kind: SubmissionKind;
  id: string;
  status: SubmissionStatus;
  /** ⚠️ 여기 담기는 것은 **공개 URL**이다. places.photos(경로)와 모양이 다르다 */
  photos: string[];
  note: string | null;
  submitter: { id: string; nickname: string | null };
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** 신규 제보에만 있다. 이 제보가 가리키는 유일한 값 */
  naverPlaceUrl: string | null;
  /**
   * 제보자가 적은 가게 이름. **확인된 상호가 아니라 검수의 출발점이다.**
   * 선택 입력이라 비어 있을 수 있고, 그때는 링크를 열어 확인한다.
   */
  placeName: string | null;
  /** 신규 제보면 승인 후 연결된 카페(대기 중에는 null), 수정 요청이면 대상 카페 */
  place: { id: string; name: string; slug: string | null } | null;
}
