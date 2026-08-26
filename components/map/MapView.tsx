'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import AuthDock from '@/components/auth/AuthDock';
import AuthProvider, { useAuth } from '@/components/auth/AuthProvider';
import LoginRequiredModal from '@/components/auth/LoginRequiredModal';
import BookmarkPanel from '@/components/bookmark/BookmarkPanel';
import BookmarkProvider from '@/components/bookmark/BookmarkProvider';
import CafeCard from '@/components/cafe/CafeCard';
import CafeListPanel from '@/components/cafe/CafeListPanel';
import EditRequestModal from '@/components/submission/EditRequestModal';
import NewPlaceModal from '@/components/submission/NewPlaceModal';
import { filterCafes } from '@/lib/cafe-search';
import CafeMarkers from './CafeMarkers';
import KakaoMap from './KakaoMap';
import MapCenterInset from './MapCenterInset';

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
  // 첫 렌더는 빈 검색어다 (R10). 목록과 마커가 같은 걸러진 배열을 받아야 하므로(R3)
  // 상태는 그 둘을 함께 쥔 여기에 둔다 — CafeListPanel 안에 두면 마커가 값을 모른다.
  const [query, setQuery] = useState('');
  const { loginPrompt, dismissLoginPrompt, requireLogin } = useAuth();
  // dock이 지도 중심을 가리는지 재려면 실제 크기가 필요하다 (MapCenterInset).
  const dockRef = useRef<HTMLDivElement>(null);

  const filteredCafes = filterCafes(cafes, query);

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
        {/* 좁은 화면에서 dock 뒤에 깔리는 중심을 보이는 자리로 내린다 */}
        <MapCenterInset obstructionRef={dockRef} />
        <CafeMarkers
          cafes={filteredCafes}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />
      </KakaoMap>

      {/* 지도 탐색을 시작하는 dock이다. DESIGN.md Left Panel 순서 1-7번이 여기 있다.
          검색 입력칸은 7번 카페 전체 목록 상자 안에 있다 (2026-08-26) — 별도
          순서를 차지하지 않는다.
          7번 전체 목록이 붙어도 dock이 지도를 밀어내지 않는 것은 목록 자체가
          스크롤하기 때문이다 (globals.css .dock-cafe-list). */}
      <div className="brand-dock" ref={dockRef}>
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1>카공맵</h1>
        <p className="brand-dock__sub">
          오래 앉아 작업하기 좋은 카페 {cafes.length}곳{' '}
          {/* 목록은 지도의 대체가 아니라 크롤러와 사람 둘 다를 위한 읽는 화면이다.
              CTA로 키우지 않는다 — dock의 주인공은 지도다 (DESIGN.md Cafe List Page). */}
          <Link href="/cafes" className="brand-dock__list-link">
            목록으로 보기
          </Link>
        </p>
        <AuthDock />
        {/* 로그인 전에도 보인다 — 제보할 수 있다는 사실 자체가 로그인의 이유다.
            누르면 저장 대신 로그인 모달이 뜬다 (상세 하트와 같은 규칙). */}
        <button type="button" className="dock-action" onClick={() => openForm('new')}>
          카페 제보하기
        </button>
        {/* 북마크에서 카페를 고르면 상세가 열린다. 지도를 그쪽으로 옮기지는
            않는다 — 목록은 탐색 도구가 아니라 저장 목록이다. */}
        <BookmarkPanel onSelect={handleSelect} />
        {/* 전체 목록은 dock 맨 아래다. 북마크(내가 고른 것)를 먼저 보고, 그 아래에서
            아직 고르지 않은 카페를 고른다. 검색 입력칸은 이 패널 안, 제목과 목록
            사이에 있다 — 값의 주인은 여기(MapShell)지만 자리는 목록 상자 안이다. */}
        <CafeListPanel
          cafes={filteredCafes}
          query={query}
          onQueryChange={setQuery}
          onSelect={handleSelect}
        />
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
