import { createServerSupabase } from '@/lib/supabase-server';
import { requireCurator } from '@/lib/admin/guard';
import type {
  StatusFilter,
  SubmissionItem,
  SubmissionKind,
  SubmissionStatus,
} from '@/lib/admin/submission';

/**
 * ★ 제보 검수 데이터 접근 계층 (서버 전용)
 *
 * `lib/cafes.ts`가 세운 규칙을 그대로 따른다 — **컴포넌트는 테이블을 직접 건드리지
 * 않는다.** 다른 점은 세션이 필요해서 서버 클라이언트를 쓴다는 것뿐이고, 그래서
 * 이 파일은 브라우저에서 import할 수 없다.
 *
 * 두 테이블(`place_reports`, `place_edit_requests`)을 **화면에서 같은 모양으로** 다룬다.
 * 담는 정보가 다르다는 이유로 테이블을 갈랐지만(20260820115447), 검수하는 사람이
 * 보는 것 — 사진·메모·누가·언제 — 은 같기 때문이다. 갈리는 것은 "무엇을 가리키는가"
 * 하나뿐이라 `naverPlaceUrl`과 `place` 두 칸으로 흡수된다.
 *
 * 행 타입과 상태 라벨은 `lib/admin/submission.ts`에 있다 — 표와 dialog가 그것을 알아야
 * 하는데 이 파일은 `next/headers`에 닿아 클라이언트가 import할 수 없기 때문이다.
 */

/**
 * '*'를 쓰지 않는다. 한 줄 리터럴이어야 supabase-js가 결과 타입을 추론한다
 * (이어붙이면 GenericStringError로 떨어진다 — lib/cafes.ts의 PLACE_COLUMNS와 같은 이유).
 */
const REPORT_COLUMNS =
  'id, status, photos, note, submitted_by, created_at, reviewed_at, review_note, naver_place_url, place_name, places(id, name, slug)';
const EDIT_COLUMNS =
  'id, status, photos, note, submitted_by, created_at, reviewed_at, review_note, places(id, name, slug)';

interface RawRow {
  id: string;
  status: SubmissionStatus;
  photos: string[] | null;
  note: string | null;
  submitted_by: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  naver_place_url?: string | null;
  place_name?: string | null;
  places: { id: string; name: string; slug: string | null } | null;
}

/**
 * 제보자 닉네임을 붙인다.
 *
 * join으로 하지 못하는 이유: `submitted_by`는 `auth.users(id)`를 참조하고 `profiles.id`도
 * 같은 곳을 참조한다. 둘 사이에 직접 FK가 없어 PostgREST가 임베드 관계를 만들지
 * 못한다. 그래서 id를 모아 한 번 더 조회하고 여기서 붙인다 — 요청 두 번이지만
 * 목록 한 페이지에 대해 두 번이지 행마다 두 번이 아니다.
 */
async function attachSubmitters(rows: RawRow[], kind: SubmissionKind): Promise<SubmissionItem[]> {
  if (rows.length === 0) return [];

  const supabase = await createServerSupabase();
  const ids = [...new Set(rows.map((row) => row.submitted_by))];

  const { data } = await supabase
    .from('profiles')
    .select('id, nickname')
    .in('id', ids)
    .returns<{ id: string; nickname: string | null }[]>();

  const nicknames = new Map((data ?? []).map((profile) => [profile.id, profile.nickname]));

  return rows.map((row) => ({
    kind,
    id: row.id,
    status: row.status,
    photos: row.photos ?? [],
    note: row.note,
    submitter: {
      id: row.submitted_by,
      // 프로필이 없을 수 있다 — 가입 트리거 이전 계정이거나 탈퇴 직후다.
      nickname: nicknames.get(row.submitted_by) ?? null,
    },
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    naverPlaceUrl: row.naver_place_url ?? null,
    placeName: row.place_name ?? null,
    place: row.places,
  }));
}

async function listFrom(
  table: 'place_reports' | 'place_edit_requests',
  columns: string,
  kind: SubmissionKind,
  filter: StatusFilter,
): Promise<SubmissionItem[]> {
  // 조회에도 판정을 건다. 페이지가 guardAdminPage()를 빠뜨려도 데이터가 나가지 않게
  // 하는 뒷단이다 — RLS 하나에 기대지 않는다.
  await requireCurator();
  const supabase = await createServerSupabase();

  let query = supabase.from(table).select(columns).order('created_at', { ascending: false });
  if (filter !== 'all') query = query.eq('status', filter);

  const { data, error } = await query.returns<RawRow[]>();
  if (error) {
    throw new Error(`제보를 불러오지 못했습니다: ${error.message}`);
  }

  return attachSubmitters(data ?? [], kind);
}

export async function listPlaceReports(filter: StatusFilter): Promise<SubmissionItem[]> {
  return listFrom('place_reports', REPORT_COLUMNS, 'report', filter);
}

export async function listEditRequests(filter: StatusFilter): Promise<SubmissionItem[]> {
  return listFrom('place_edit_requests', EDIT_COLUMNS, 'edit', filter);
}

/**
 * 한 건만 읽는다. 장소 폼이 참고 자료(사진·메모·URL)를 보여줄 때 쓴다.
 *
 * 목록과 같은 변환을 지나게 해서 `SubmissionItem` 하나로 통일한다 — 폼이 두 번째
 * 모양을 알게 되면 표와 폼이 서로 다른 것을 보여주기 시작한다.
 */
export async function getSubmission(
  kind: SubmissionKind,
  id: string,
): Promise<SubmissionItem | null> {
  await requireCurator();
  const supabase = await createServerSupabase();
  const table = kind === 'report' ? 'place_reports' : 'place_edit_requests';
  const columns = kind === 'report' ? REPORT_COLUMNS : EDIT_COLUMNS;

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('id', id)
    .maybeSingle<RawRow>();

  if (error) {
    throw new Error(`제보를 불러오지 못했습니다: ${error.message}`);
  }
  if (!data) return null;

  const [item] = await attachSubmitters([data], kind);
  return item;
}

/** 대기 중 건수. 탭 옆 배지에 쓴다 — 필터를 바꿔도 "남은 일"은 그대로 보여야 한다 */
export async function countPending(): Promise<{ report: number; edit: number }> {
  await requireCurator();
  const supabase = await createServerSupabase();

  const [reports, edits] = await Promise.all([
    supabase.from('place_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('place_edit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return { report: reports.count ?? 0, edit: edits.count ?? 0 };
}

/**
 * 반려.
 *
 * 사유는 선택이다 — RPC의 두 번째 인자가 nullable이고, 사유 없이 반려해야 하는 건
 * (스팸, 중복)이 실제로 있다. 빈 문자열은 null로 바꿔 보낸다.
 *
 * 세 번째 인자(승인자)를 넘기지 않는다. 세션이 있으므로 `resolve_reviewer()`가
 * `auth.uid()`를 먼저 보고, 인자는 무시된다.
 */
export async function rejectSubmission(
  kind: SubmissionKind,
  id: string,
  reason: string,
): Promise<void> {
  await requireCurator();

  const supabase = await createServerSupabase();
  const fn = kind === 'report' ? 'reject_place_report' : 'reject_edit_request';
  const idArg = kind === 'report' ? 'p_report_id' : 'p_request_id';

  const { error } = await supabase.rpc(fn, {
    [idArg]: id,
    p_reason: reason.trim() || null,
  });

  if (error) {
    throw new Error(`반려하지 못했습니다: ${error.message}`);
  }
}
