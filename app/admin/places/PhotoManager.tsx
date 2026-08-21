'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { removeSlot, replaceSlot, type PhotoSlot } from '@/lib/admin/place-form';
import { ALLOWED_MIME, photoFileReason } from '@/lib/photo-rules';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 카페 사진 관리 — 추가 · 교체 · 삭제.
 *
 * 슬롯 배열 하나로 다룬다. 이미 올라간 사진과 방금 고른 파일이 **한 배열에 섞여**
 * 있어야 순서가 유지되고, `places.photos`의 첫 장이 마커 썸네일이라 순서가 곧
 * 의미다. 실제 업로드는 저장할 때 서버 액션이 한다 — 고르는 즉시 올리면 폼을 닫고
 * 마음을 바꾼 경우의 파일이 버킷에 남는다(`lib/submissions.ts`와 같은 판단).
 *
 * 모양은 DESIGN.md의 Submission Form 썸네일 규격을 따른다 — 정사각 + `{rounded.md}`
 * + `outline-variant` 테두리, **우상단 모서리에 걸친 원형 × 버튼**(`on-surface` 배경,
 * hover에 `primary`). 다만 **크기는 64px이 아니라 96px이다.** 제보 폼에서는 내가 방금
 * 고른 사진을 알아보기만 하면 되지만, 여기서는 큐레이터가 이 사진을 지도에 올릴지
 * 판단한다. 그 판단이 64px에서는 되지 않는다.
 *
 * ⚠️ 미리보기 blob URL은 `useMemo` + cleanup effect로 만든다. effect 안에서
 * `setState`하는 것도 렌더 중 ref를 읽는 것도 이 저장소의 린트가 error로 막는다.
 * `components/submission/PhotoPicker.tsx`에 같은 패턴과 그 한계(개발 모드
 * StrictMode에서 한 벌이 회수되지 못한다)가 적혀 있다.
 */
export default function PhotoManager({
  slots,
  onChange,
  disabled,
}: {
  slots: PhotoSlot[];
  onChange: (next: PhotoSlot[]) => void;
  disabled: boolean;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  /** `바꾸기`를 누른 슬롯. 파일 선택창이 닫힐 때까지 들고 있는다 */
  const [replacing, setReplacing] = useState<number | null>(null);

  const accept = Object.keys(ALLOWED_MIME);

  const previews = useMemo(() => {
    const urls = new Map<string, string>();
    for (const slot of slots) {
      if (slot.kind === 'new') urls.set(slot.key, URL.createObjectURL(slot.file));
    }
    return urls;
  }, [slots]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  /**
   * 통과한 파일만 돌려준다. 걸리면 토스트로 알리고 빈 배열.
   *
   * 파일 선택창이 닫힌 직후라 시선이 어디에 있을지 모른다. 목록 아래 한 줄로
   * 적어두면 못 보고 "왜 안 붙지"가 된다.
   */
  const accepted = (files: File[]): File[] => {
    for (const file of files) {
      const why = photoFileReason(file);
      if (why) {
        toast('이 사진은 올릴 수 없어요', { description: why });
        return [];
      }
    }
    return files;
  };

  const add = (files: File[]) => {
    const ok = accepted(files);
    if (ok.length === 0) return;
    onChange([
      ...slots,
      ...ok.map((file) => ({ kind: 'new' as const, file, key: crypto.randomUUID() })),
    ]);
  };

  const replace = (index: number, file: File) => {
    const ok = accepted([file]);
    if (ok.length === 0) return;
    onChange(replaceSlot(slots, index, ok[0], crypto.randomUUID()));
  };

  return (
    <div className="space-y-4">
      <p className="text-meta text-on-surface-variant">
        {slots.length > 0
          ? `${slots.length}장 · 첫 장이 마커 썸네일이 됩니다`
          : 'JPG · PNG · WebP, 한 장 5MB까지'}
      </p>

      {/* 파일 입력 둘을 숨겨 두고 버튼으로 연다. 브라우저 기본 위젯이 이 화면에서
          유일하게 OS 부품처럼 보이는 것을 피한다 (DESIGN.md — Submission Form) */}
      <input
        ref={addInputRef}
        type="file"
        className="sr-only"
        accept={accept.join(',')}
        multiple
        disabled={disabled}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          // 같은 파일을 다시 고를 수 있게 비운다. 비우지 않으면 뺐다가 같은 사진을
          // 다시 고를 때 change가 오지 않는다.
          event.target.value = '';
          add(picked);
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        className="sr-only"
        accept={accept.join(',')}
        disabled={disabled}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          if (picked !== undefined && replacing !== null) replace(replacing, picked);
          setReplacing(null);
        }}
      />

      {slots.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {slots.map((slot, index) => {
            const key = slot.kind === 'existing' ? slot.path : slot.key;
            const src = slot.kind === 'existing' ? slot.url : previews.get(slot.key);
            return (
              <li key={key} className="space-y-1">
                <div className="relative">
                  {/* next/image를 쓰지 않는다. 새로 고른 사진은 blob: URL이라
                      remotePatterns로 열 수 있는 대상이 아니고, 둘을 다른 방식으로
                      그리면 교체할 때 크기가 튄다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="size-24 rounded-md border border-outline-variant object-cover"
                  />

                  {/* 우상단 모서리에 걸친 22px 원형 버튼 — 제보 폼과 같은 규격 */}
                  <button
                    type="button"
                    onClick={() => onChange(removeSlot(slots, index))}
                    disabled={disabled}
                    aria-label={`${index + 1}번째 사진 빼기`}
                    className={cn(
                      'absolute -top-1 -right-1 grid size-[22px] place-content-center rounded-full',
                      'bg-on-surface text-surface transition-colors hover:bg-primary',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <RemoveIcon />
                  </button>

                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-surface/90 px-2 py-1 text-eyebrow text-on-surface-variant">
                      대표
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-24 px-0"
                  disabled={disabled}
                  onClick={() => {
                    setReplacing(index);
                    replaceInputRef.current?.click();
                  }}
                >
                  바꾸기
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => addInputRef.current?.click()}
      >
        {slots.length > 0 ? '사진 더 고르기' : '사진 고르기'}
      </Button>

    </div>
  );
}

/** QuickCheckIcons·PhotoPicker와 같은 규격 — 16x16, currentColor stroke, 라이브러리 없음 */
function RemoveIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4.8 4.8l6.4 6.4M11.2 4.8l-6.4 6.4" />
    </svg>
  );
}
