'use client';

import Link from 'next/link';
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
  const { user, resolved, isCurator, error, signIn, signOut } = useAuth();

  return (
    <div className="auth-dock">
      {resolved &&
        (user ? <Profile user={user} onSignOut={signOut} /> : <KakaoButton onClick={signIn} />)}

      {/*
        운영 화면 입구. **큐레이터에게만 보인다.**

        원래는 아무에게도 보여주지 않기로 했었다(주소를 직접 친다). 뒤집은 이유는
        단순하다 — 제보를 처리하는 사람도 지도를 쓰는 사람이고, 매번 주소창에
        `/admin/reports`를 치게 하는 것은 화면이 할 일을 사람에게 미루는 것이다.

        ⚠️ 이 조건은 **표시**만 정한다. 접근 제어가 아니다. anon 키가 브라우저에
        나가므로 클라이언트 판정은 조작할 수 있고, 실제 방어선은 서버에 셋 있다
        (guardAdminPage · requireCurator · RLS). 억지로 들어가도 404다.

        제보 버튼(.dock-action)과 같은 규격을 쓴다. 카카오 노랑 말고 큰 색을 하나
        더 만들지 않는다 (DESIGN.md — 큰 CTA를 여러 개 만들지 않는다).

        **새 탭으로 연다.** 운영과 지도는 오가는 일이 잦은데, 같은 탭에서 열면
        검수하다 지도를 확인하러 나갔다 돌아올 때마다 보던 목록과 필터를 잃는다.
        보고 있던 지도도 마찬가지다.
      */}
      {resolved && isCurator && (
        <Link
          className="dock-action dock-action--link"
          href="/admin/reports"
          target="_blank"
          rel="noopener"
          // 새 탭으로 열린다는 것을 스크린리더에도 알린다. 아이콘을 하나 더 얹는 대신
          // 라벨로 처리한다 — dock은 좁고, 이 저장소는 숨김 텍스트 대신 aria-label을 쓴다
          // (CafeMarker·PhotoCarousel과 같은 방식).
          aria-label="운영 화면 열기 (새 탭)"
          title="운영 화면 (새 탭에서 열림)"
        >
          <GearIcon />
          운영 화면
        </Link>
      )}

      {error && <p className="auth-dock__error">{error}</p>}
    </div>
  );
}

/** QuickCheckIcons와 같은 규격 — 16x16, currentColor stroke, 라이브러리 없음 */
function GearIcon() {
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
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" />
    </svg>
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
