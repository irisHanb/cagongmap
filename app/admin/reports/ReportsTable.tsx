'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusBadge from '@/components/admin/StatusBadge';
import { formatDateTime, hostOf, truncate } from '@/lib/admin/format';
import type { SubmissionItem, SubmissionKind } from '@/lib/admin/submission';
import ReportDialog from './ReportDialog';

/**
 * 제보 표.
 *
 * 클라이언트인 이유는 **선택 상태 하나** 때문이다. 행을 누르면 dialog가 열려야 하고
 * 그 "지금 열려 있는 행"은 URL에 둘 만한 값이 아니다(탭·필터와 달리 왔다 갔다 하는
 * 대상이 아니라 그 자리에서 닫힌다).
 *
 * 행 전체가 버튼이다. 셀 하나에만 링크를 두면 검수하는 사람이 매번 그 좁은 칸을
 * 겨냥해야 한다.
 *
 * 표를 담는 상자는 dock·상세 패널과 같은 규격이다 — `{rounded.panel}` + `{shadows.brew}`,
 * 테두리 없이. 밝은 표면 위에 그림자로만 떠 있게 한다 (DESIGN.md — Do).
 */
export default function ReportsTable({
  items,
  kind,
}: {
  items: SubmissionItem[];
  kind: SubmissionKind;
}) {
  const [selected, setSelected] = useState<SubmissionItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-panel bg-surface-low px-6 py-12 text-center text-body text-on-surface-variant">
        해당하는 제보가 없어요.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-panel bg-surface-lowest shadow-brew">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">상태</TableHead>
              <TableHead>{kind === 'report' ? '가게' : '대상 카페'}</TableHead>
              <TableHead className="w-16 text-right">사진</TableHead>
              <TableHead>메모</TableHead>
              <TableHead className="w-32">보낸 사람</TableHead>
              <TableHead className="w-40">보낸 때</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                tabIndex={0}
                role="button"
                aria-label={`${kind === 'report' ? '제보' : '수정 요청'} 상세 열기`}
                className="cursor-pointer focus-visible:bg-surface-low focus-visible:outline-none"
                onClick={() => setSelected(item)}
                onKeyDown={(event) => {
                  // 행이 버튼 역할을 하므로 키보드로도 같은 일이 되어야 한다.
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(item);
                  }
                }}
              >
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  {/* 제보자가 이름을 적었으면 그것을, 아니면 링크의 도메인을 보여준다.
                      도메인만 줄줄이 찍히던 표에 이름을 넣으려고 이 칸을 받았다 */}
                  <span className="block font-bold">
                    {kind === 'report'
                      ? (item.placeName ?? hostOf(item.naverPlaceUrl))
                      : (item.place?.name ?? '—')}
                  </span>
                  {kind === 'report' && item.placeName && (
                    <span className="block text-meta text-on-surface-variant">
                      {hostOf(item.naverPlaceUrl)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-on-surface-variant">
                  {item.photos.length}
                </TableCell>
                <TableCell className="text-on-surface-variant">{truncate(item.note)}</TableCell>
                <TableCell className="text-on-surface-variant">
                  {item.submitter.nickname ?? '—'}
                </TableCell>
                <TableCell className="tabular-nums text-on-surface-variant">
                  {formatDateTime(item.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReportDialog item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
