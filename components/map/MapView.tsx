'use client';

import { useCallback, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import CafeCard from '@/components/cafe/CafeCard';
import CafeMarkers from './CafeMarkers';
import KakaoMap from './KakaoMap';

/** 송리단길 일대 — 송파·잠실 권역 기준점 (docs/scope.md) */
const INITIAL_CENTER = { lat: 37.5078, lng: 127.1072 };

/**
 * 지도가 화면 전부를 쓰고, 나머지 UI는 그 위에 뜬다 (DESIGN.md — Map Shell).
 * 상단 헤더 바를 두지 않는 이유가 그것이다.
 */
export default function MapView({ cafes }: { cafes: Cafe[] }) {
  const [selected, setSelected] = useState<Cafe | null>(null);

  // CafeMarker의 useEffect 의존성으로 들어가므로 참조를 고정한다.
  const handleSelect = useCallback((cafe: Cafe) => setSelected(cafe), []);
  const handleClose = useCallback(() => setSelected(null), []);

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
          검색바·로그인·북마크는 아직 스코프 밖이라 자리만 비어 있다. */}
      <div className="brand-dock">
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1>카공맵</h1>
        <p className="brand-dock__sub">오래 앉아 작업하기 좋은 카페 {cafes.length}곳</p>
      </div>

      {/* key로 카페마다 새로 마운트해 사진 슬라이드를 첫 장으로 되돌린다 */}
      {selected && <CafeCard key={selected.id} cafe={selected} onClose={handleClose} />}
    </main>
  );
}
