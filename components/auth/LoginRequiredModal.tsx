'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { KakaoIcon } from './KakaoIcon';

/**
 * 로그인이 필요할 때 띄우는 알림.
 *
 * DESIGN.md에 모달 규격이 없어 기존 토큰만으로 짰다 — 상세 패널과 같은 surface,
 * r-panel 모서리, shadow-brew. 새 색이나 스케일 밖 여백을 만들지 않았다.
 *
 * 막다른 골목을 만들지 않는다. 여기서 바로 로그인할 수 있고, Escape·배경 클릭·
 * 나중에 버튼 셋 다 닫힌다.
 */
export default function LoginRequiredModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 열리면 포커스를 모달 안으로 옮긴다. 안 그러면 키보드 사용자가
    // 뒤쪽 지도를 계속 만지게 된다.
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    // 배경 클릭으로 닫는다. 안쪽 클릭이 올라와서 닫지 않도록 stopPropagation한다.
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title" id="login-required-title">
          로그인이 필요해요
        </h2>
        <p className="modal__body">
          카페를 북마크에 저장하려면 카카오 로그인이 필요합니다. 저장한 카페는 지도 왼쪽에서
          다시 볼 수 있어요.
        </p>

        <button type="button" className="kakao-login" onClick={signIn}>
          <KakaoIcon />
          카카오 로그인
        </button>

        <button type="button" className="modal__dismiss" onClick={onClose} ref={closeRef}>
          나중에
        </button>
      </div>
    </div>
  );
}
