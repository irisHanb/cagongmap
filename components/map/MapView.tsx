'use client';

import { useCallback, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import CafeMarkers from './CafeMarkers';
import CafeOverlay from './CafeOverlay';
import KakaoMap from './KakaoMap';

/** 송리단길 일대 — 송파·잠실 권역 기준점 (docs/scope.md) */
const INITIAL_CENTER = { lat: 37.5078, lng: 127.1072 };

export default function MapView({ cafes }: { cafes: Cafe[] }) {
  const [selected, setSelected] = useState<Cafe | null>(null);

  // CafeMarkers의 useEffect 의존성으로 들어가므로 참조를 고정한다.
  // 이걸 빼면 렌더마다 마커를 전부 지웠다 다시 만든다.
  const handleSelect = useCallback((cafe: Cafe) => setSelected(cafe), []);
  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <main className="map-view">
      <header className="map-view__header">
        <h1>카공맵</h1>
        <p>노트북 작업하기 좋은 카페 · 송파·잠실</p>
      </header>

      <KakaoMap center={INITIAL_CENTER} level={5}>
        <CafeMarkers cafes={cafes} onSelect={handleSelect} />
        {/* 카드는 마커 위에 붙는다 — 지도 좌표가 필요하므로 KakaoMap 안에 있어야 한다 */}
        <CafeOverlay cafe={selected} onClose={handleClose} />
      </KakaoMap>
    </main>
  );
}
