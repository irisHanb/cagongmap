import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/admin/PageHeader';
import { guardAdminPage } from '@/lib/admin/guard';
import { countPending, listEditRequests, listPlaceReports } from '@/lib/admin/reports';
import {
  parseStatusFilter,
  STATUS_FILTERS,
  STATUS_LABEL,
  type StatusFilter,
  type SubmissionKind,
} from '@/lib/admin/submission';
import { cn } from '@/lib/utils';
import ReportsTable from './ReportsTable';

export const metadata = { title: '제보' };

/**
 * 제보 검수 목록.
 *
 * **탭과 필터를 URL에 둔다.** 컴포넌트 state로 들면 새로고침에 사라지고, 승인하러
 * 장소 폼에 갔다가 돌아왔을 때 보던 자리를 잃는다. 검수는 왔다 갔다 하는 일이라
 * 그 왕복이 잦다.
 *
 * 서버 컴포넌트다. 목록 조회가 세션 쿠키를 읽으므로 이 라우트는 어차피 동적이고,
 * 그래서 클라이언트로 내릴 이유가 없다. 선택 상태를 드는 표만 클라이언트다.
 */
function tabOf(value: string | string[] | undefined): SubmissionKind {
  return value === 'edit' ? 'edit' : 'report';
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  // 첫 줄이다. 레이아웃 가드만으로는 이 페이지가 렌더되는 것을 막지 못한다
  // (lib/admin/guard.ts의 guardAdminPage 주석 참고).
  await guardAdminPage();

  const sp = await searchParams;
  const tab = tabOf(sp.tab);
  const status = parseStatusFilter(first(sp.status));

  const [items, pending] = await Promise.all([
    tab === 'report' ? listPlaceReports(status) : listEditRequests(status),
    countPending(),
  ]);

  const tabs: { kind: SubmissionKind; label: string; count: number }[] = [
    { kind: 'report', label: '새 장소 제보', count: pending.report },
    { kind: 'edit', label: '정보 수정 요청', count: pending.edit },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="REPORTS"
        title="제보"
        description="사용자가 보낸 것을 읽고 승인하거나 반려합니다. 승인은 장소를 저장할 때 함께 확정됩니다."
      />

      {/* 탭 — 링크다. 대기 건수는 필터와 무관하게 "남은 일"을 보여준다 */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-outline-variant">
        {tabs.map((item) => {
          const active = tab === item.kind;
          return (
            <Link
              key={item.kind}
              href={`/admin/reports?tab=${item.kind}&status=${status}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-6 py-4 text-body font-bold transition-colors',
                active
                  ? 'border-primary text-on-surface'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface',
              )}
            >
              {item.label}
              {item.count > 0 && (
                <Badge>{item.count}</Badge>
              )}
            </Link>
          );
        })}
      </div>

      {/* 상태 필터 — dock의 pill 규격을 따른다. 좁은 화면에서는 줄로 내려간다 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {STATUS_FILTERS.map((value: StatusFilter) => {
          const active = status === value;
          return (
            <Link
              key={value}
              href={`/admin/reports?tab=${tab}&status=${value}`}
              className={cn(
                'flex h-10 items-center rounded-full border px-6 text-label transition-colors',
                active
                  ? 'border-transparent bg-surface-container text-on-surface'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-low',
              )}
            >
              {value === 'all' ? '전체' : STATUS_LABEL[value]}
            </Link>
          );
        })}
      </div>

      <ReportsTable items={items} kind={tab} />
    </div>
  );
}
