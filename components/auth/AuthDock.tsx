'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';
import { KakaoIcon } from './KakaoIcon';

/**
 * 좌측 dock의 로그인 영역 (DESIGN.md — Left Panel 5번, Kakao Login).
 *
 * 세션 상태는 AuthProvider가 들고 있다. 여기는 그리기만 한다.
 * 판정 전에는 버튼도 프로필도 그리지 않는다 — 로그인 버튼이 떴다가 프로필로
 * 바뀌는 깜빡임을 만들지 않으려는 것이다.
 */
export default function AuthDock() {
  const { user, resolved, error, signIn, signOut } = useAuth();

  return (
    <div className="auth-dock">
      {resolved &&
        (user ? <Profile user={user} onSignOut={signOut} /> : <KakaoButton onClick={signIn} />)}
      {error && <p className="auth-dock__error">{error}</p>}
    </div>
  );
}

function KakaoButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="kakao-login" onClick={onClick}>
      <KakaoIcon />
      카카오 로그인
    </button>
  );
}

/**
 * 카카오가 넘겨주는 키 이름은 동의항목 설정에 따라 갈린다. 하나로 가정하지 않고
 * 순서대로 훑는다. 닉네임 동의를 받지 않으면 이름도 이메일도 없을 수 있어서
 * 마지막 폴백을 둔다.
 */
function readProfile(user: User) {
  const meta = user.user_metadata ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  };

  return {
    name: pick('name', 'full_name', 'preferred_username', 'user_name') ?? '카카오 사용자',
    // 카카오 이메일은 선택 동의라 없을 수 있다. 없으면 줄 자체를 빼고 자리를 만들지 않는다.
    email: user.email ?? pick('email'),
    avatar: pick('avatar_url', 'picture'),
  };
}

function Profile({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { name, email, avatar } = readProfile(user);
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="auth-profile">
      {/* next/image를 쓰지 않는다. 카카오 CDN은 next.config.ts의 remotePatterns
          밖이고, 그걸 열자고 Storage만 허용해 둔 범위를 넓히지 않는다. */}
      {avatar && !avatarFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="auth-profile__avatar"
          src={avatar}
          alt=""
          width={40}
          height={40}
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span className="auth-profile__avatar auth-profile__avatar--fallback" aria-hidden>
          {name.slice(0, 1)}
        </span>
      )}

      <span className="auth-profile__text">
        <strong className="auth-profile__name">{name}</strong>
        {email && <span className="auth-profile__email">{email}</span>}
      </span>

      <button
        type="button"
        className="auth-profile__signout"
        onClick={onSignOut}
        aria-label="로그아웃"
        title="로그아웃"
      >
        <SignOutIcon />
      </button>
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6" />
      <path d="M10.5 11 14 8l-3.5-3M14 8H6" />
    </svg>
  );
}
