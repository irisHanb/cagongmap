'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * 제보 폼 두 개(수정 요청·새 장소)가 함께 쓰는 껍데기.
 *
 * DESIGN.md는 2026-08-15까지 "모달은 로그인 안내 하나뿐"이었다. 사진을 여러 장
 * 올리는 폼을 400px 상세 패널이나 390px dock 안에 넣으면 모바일에서 손이 갇히기
 * 때문에 2026-08-20에 그 규칙을 열었고, 대신 **모달은 이 껍데기 하나로만 늘린다.**
 *
 * 로그인 모달과 같은 규격을 쓴다 — 같은 scrim, surface, r-panel, shadow-brew.
 * 막다른 골목을 만들지 않는 것도 같다: Escape·배경 클릭·취소 셋 다 닫힌다.
 */
export default function SubmissionModal({
  title,
  description,
  submitLabel,
  canSubmit,
  pending,
  error,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  canSubmit: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 열리면 포커스를 모달 안으로 옮긴다. 안 그러면 키보드 사용자가 뒤쪽 지도를
    // 계속 만지게 된다.
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal modal--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <p className="modal__body">{description}</p>

        {/* 폼 제출은 버튼 onClick이 아니라 form onSubmit으로 받는다.
            Enter로도 보낼 수 있어야 한다. */}
        <form
          className="submission-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !pending) onSubmit();
          }}
        >
          {children}

          {/* 실패에 색을 주지 않는다 — 색이 드는 것은 좋은 조건뿐이다 (DESIGN.md) */}
          {error && <p className="form-error">{error}</p>}

          <div className="submission-form__actions">
            <button type="submit" className="button-primary" disabled={!canSubmit || pending}>
              {pending ? '보내는 중…' : submitLabel}
            </button>
            <button
              type="button"
              className="modal__dismiss"
              onClick={onClose}
              ref={closeRef}
              disabled={pending}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
