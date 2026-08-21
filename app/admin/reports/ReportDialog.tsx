'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/admin/StatusBadge';
import { formatDateTime } from '@/lib/admin/format';
import type { SubmissionItem } from '@/lib/admin/submission';
import { rejectSubmissionAction } from './actions';

/**
 * 제보 상세.
 *
 * ⚠️ **승인 버튼은 승인하지 않는다.** `approve_place_report()`가 이미 존재하는 카페의
 * id를 인자로 요구하기 때문이다 — 승인은 카페가 생긴 뒤에만 가능하다. 그래서 이
 * 버튼은 장소 폼으로 보내기만 하고, 상태 전환은 폼의 저장 액션이 `places` 쓰기와
 * 이어서 한다. 중간에 그만두면 제보는 pending으로 남고 유령 draft 행도 생기지 않는다.
 *
 * 모양은 DESIGN.md의 Modal 공통 규격을 그대로 쓴다(scrim·panel·radius·shadow는
 * `components/ui/dialog.tsx`에 있다). **큰 CTA는 하나뿐이다** — 승인만 primary이고
 * 반려는 무채색이다. 색이 드는 것은 좋은 조건뿐이라는 규칙이 여기에도 적용된다.
 */
export default function ReportDialog({
  item,
  onClose,
}: {
  item: SubmissionItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        {/* key로 갈아끼워 다른 제보를 열 때 반려 사유와 오류 문구가 따라오지 않게 한다 */}
        {item && <DialogBody key={item.id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({ item, onClose }: { item: SubmissionItem; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rejecting, startReject] = useTransition();

  const isReport = item.kind === 'report';
  const pending = item.status === 'pending';

  /**
   * 승인 경로. 신규 제보는 카페를 만들러, 수정 요청은 그 카페를 고치러 간다.
   * 수정 요청의 place_id는 not null이지만 타입이 nullable이라 한 번 막아 둔다.
   */
  const approveHref = isReport
    ? `/admin/places/new?report=${item.id}`
    : item.place
      ? `/admin/places/${item.place.id}/edit?request=${item.id}`
      : null;

  const reject = () => {
    setError(null);
    startReject(async () => {
      const result = await rejectSubmissionAction(item.kind, item.id, reason);
      if (!result.ok) {
        setError(result.message);
        toast('반려하지 못했어요', { description: result.message });
        return;
      }
      // 반려에 success(민트)를 쓰지 않는다. 정상적으로 끝난 동작이지만 "좋은 결과"는
      // 아니고, 색이 드는 것은 좋은 조건뿐이라는 규칙이 여기에도 적용된다 (DESIGN.md).
      toast(isReport ? '제보를 반려했어요' : '수정 요청을 반려했어요', {
        description: reason.trim() || undefined,
      });
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isReport ? '새 장소 제보' : '정보 수정 요청'}
          <StatusBadge status={item.status} />
        </DialogTitle>
        <DialogDescription>
          {item.submitter.nickname ?? '알 수 없는 사용자'} · {formatDateTime(item.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <dl className="space-y-4">
        {/* 제보자가 적은 이름. 없으면 줄 자체를 뺀다 — 자리를 비워두지 않는 규칙
            (DESIGN.md, 카카오 이메일이 없을 때와 같다) */}
        {isReport && item.placeName && <Field label="가게 이름">{item.placeName}</Field>}

        {isReport ? (
          <Field label="네이버 링크">
            {item.naverPlaceUrl ? (
              <a
                href={item.naverPlaceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all underline underline-offset-4 hover:text-primary"
              >
                {item.naverPlaceUrl}
              </a>
            ) : (
              '—'
            )}
          </Field>
        ) : (
          <Field label="대상 카페">
            {item.place ? (
              <a
                href={`/admin/places/${item.place.id}/edit`}
                className="underline underline-offset-4 hover:text-primary"
              >
                {item.place.name}
              </a>
            ) : (
              '—'
            )}
          </Field>
        )}

        <Field label="메모">
          <p className="whitespace-pre-wrap">{item.note?.trim() || '—'}</p>
        </Field>

        <Field label={`사진 ${item.photos.length}장`}>
          {item.photos.length === 0 ? (
            '—'
          ) : (
            <ul className="flex flex-wrap gap-2">
              {item.photos.map((url) => (
                <li key={url}>
                  {/* 64px 정사각 · {rounded.md} · outline-variant 테두리 — 제보 폼의
                      썸네일과 같은 규격이다. 진짜 판단은 원본을 열어서 한다 */}
                  <a href={url} target="_blank" rel="noreferrer noopener" title="원본 열기">
                    <Image
                      src={url}
                      alt=""
                      width={64}
                      height={64}
                      className="size-16 rounded-md border border-outline-variant object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Field>

        {/* 이미 처리된 건이면 그 결과를 보여준다. 무엇이 왜 반려됐는지는
            다음에 같은 제보가 왔을 때 필요한 정보다 */}
        {!pending && (
          <Field label="처리 결과">
            <p>
              {formatDateTime(item.reviewedAt)}
              {item.status === 'approved' && item.place && ` · ${item.place.name}(으)로 등록`}
            </p>
            {item.reviewNote && (
              <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{item.reviewNote}</p>
            )}
          </Field>
        )}
      </dl>

      {pending && (
        <div className="space-y-4 border-t border-outline-variant pt-6">
          <div className="space-y-2">
            <Label htmlFor="reject-reason">반려 사유</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="적지 않아도 반려할 수 있어요"
              rows={2}
              disabled={rejecting}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={rejecting}>
              닫기
            </Button>
            <Button variant="secondary" onClick={reject} disabled={rejecting}>
              {rejecting ? '반려하는 중…' : '반려'}
            </Button>
            {approveHref && (
              <Button onClick={() => router.push(approveHref)} disabled={rejecting}>
                {isReport ? '승인하고 장소 만들기' : '승인하고 장소 수정'}
              </Button>
            )}
          </DialogFooter>

          {/* 실패 문구는 12px 회색 한 줄이다. 실패에 색을 주지 않는다 (DESIGN.md) */}
          {error && <p className="text-right text-meta text-on-surface-variant">{error}</p>}
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <dt className="text-label text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 text-body">{children}</dd>
    </div>
  );
}
