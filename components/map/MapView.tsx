'use client';

import { useCallback, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import AuthDock from '@/components/auth/AuthDock';
import AuthProvider, { useAuth } from '@/components/auth/AuthProvider';
import LoginRequiredModal from '@/components/auth/LoginRequiredModal';
import BookmarkPanel from '@/components/bookmark/BookmarkPanel';
import BookmarkProvider from '@/components/bookmark/BookmarkProvider';
import CafeCard from '@/components/cafe/CafeCard';
import EditRequestModal from '@/components/submission/EditRequestModal';
import NewPlaceModal from '@/components/submission/NewPlaceModal';
import CafeMarkers from './CafeMarkers';
import KakaoMap from './KakaoMap';

/** 송리단길 일대 — 송파·잠실 권역 기준점 (docs/scope.md) */
const INITIAL_CENTER = { lat: 37.5078, lng: 127.1072 };

/**
 * 지도가 화면 전부를 쓰고, 나머지 UI는 그 위에 뜬다 (DESIGN.md — Map Shell).
 * 상단 헤더 바를 두지 않는 이유가 그것이다.
 */
export default function MapView({ cafes }: { cafes: Cafe[] }) {
  return (
    <AuthProvider>
      <BookmarkProvider>
        <MapShell cafes={cafes} />
      </BookmarkProvider>
    </AuthProvider>
  );
}

/**
 * 프로바이더 안쪽. useAuth를 쓰려면 provider보다 아래에 있어야 해서
 * MapView에서 한 겹 갈랐다.
 *
 * 모달은 전부 여기서 띄운다. 상세 패널이나 dock 안에서 띄우면 그 패널의 스택
 * 컨텍스트에 갇혀 지도 위 다른 것들과 겹치는 순서가 화면마다 달라진다.
 */
function MapShell({ cafes }: { cafes: Cafe[] }) {
  const [selected, setSelected] = useState<Cafe | null>(null);
  /** 열려 있는 폼 모달. 로그인 유도와 달리 화면당 하나로 제한할 이유가 없어 따로 둔다 */
  const [form, setForm] = useState<'edit' | 'new' | null>(null);
  const { loginPrompt, dismissLoginPrompt, requireLogin } = useAuth();

  // CafeMarker의 useEffect 의존성으로 들어가므로 참조를 고정한다.
  const handleSelect = useCallback((cafe: Cafe) => setSelected(cafe), []);
  const handleClose = useCallback(() => setSelected(null), []);
  const closeForm = useCallback(() => setForm(null), []);

  // 로그인 판정은 여기서 한 번만 한다. 판정을 통과하지 못하면 모달 대신
  // 로그인 안내가 뜬다 (AuthProvider.requireLogin).
  const openForm = useCallback(
    (kind: 'edit' | 'new') => {
      if (!requireLogin('submission')) return;
      setForm(kind);
    },
    [requireLogin],
  );

  return (
    <main className={`map-view${selected ? ' map-view--detail' : ''}`}>
      <KakaoMap center={INITIAL_CENTER} level={5}>
        <CafeMarkers
          cafes={cafes}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />
      </KakaoMap>

      {/* 탐색 결과를 늘어놓는 곳이 아니라 지도 탐색을 시작하는 dock이다.
          DESIGN.md Left Panel 순서의 1-3번, 5번, 6번이 여기 있다.
          4번 검색바만 아직 스코프 밖이라 자리를 만들지 않았다. */}
      <div className="brand-dock">
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1>카공맵</h1>
        <p className="brand-dock__sub">오래 앉아 작업하기 좋은 카페 {cafes.length}곳</p>
        <AuthDock />
        {/* 로그인 전에도 보인다 — 제보할 수 있다는 사실 자체가 로그인의 이유다.
            누르면 저장 대신 로그인 모달이 뜬다 (상세 하트와 같은 규칙). */}
        <button type="button" className="dock-action" onClick={() => openForm('new')}>
          카페 제보하기
        </button>
        {/* 북마크에서 카페를 고르면 상세가 열린다. 지도를 그쪽으로 옮기지는
            않는다 — 목록은 탐색 도구가 아니라 저장 목록이다. */}
        <BookmarkPanel onSelect={handleSelect} />
      </div>

      {/* key로 카페마다 새로 마운트해 사진 슬라이드를 첫 장으로 되돌린다 */}
      {selected && (
        <CafeCard
          key={selected.id}
          cafe={selected}
          onClose={handleClose}
          onRequestEdit={() => openForm('edit')}
        />
      )}

      {form === 'edit' && selected && <EditRequestModal cafe={selected} onClose={closeForm} />}
      {form === 'new' && <NewPlaceModal onClose={closeForm} onSelectCafe={handleSelect} />}

      {loginPrompt && <LoginRequiredModal reason={loginPrompt} onClose={dismissLoginPrompt} />}
    </main>
  );
}
