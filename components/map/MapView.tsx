'use client';

import { useCallback, useState } from 'react';
import type { Cafe } from '@/types/cafe';
import CafeCard from '@/components/cafe/CafeCard';
import CafeMarkers from './CafeMarkers';
import KakaoMap from './KakaoMap';

/** 송리단길 일대 — 송파·잠실 권역 기준점 (docs/scope.md) */
const INITIAL_CENTER = { lat: 37.5078, lng: 127.1072 };

export default function MapView({ cafes }: { cafes: Cafe[] }) {
  const [selected, setSelected] = useState<Cafe | null>(null);

  // CafeMarker의 useEffect 의존성으로 들어가므로 참조를 고정한다.
  const handleSelect = useCallback((cafe: Cafe) => setSelected(cafe), []);
  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <main className="map-view">
      <header className="map-view__header">
        <h1>카공맵</h1>
        <p>노트북 작업하기 좋은 카페 · 송파·잠실</p>
      </header>

      {/* 데스크톱에서는 지도와 패널이 가로로 나뉘고, 모바일에서는 패널이 지도 위로
          올라온다. 지도가 좁아지는 쪽은 KakaoMap이 relayout으로 알아서 따라간다. */}
      <div className="map-view__body">
        <KakaoMap center={INITIAL_CENTER} level={5}>
          <CafeMarkers
            cafes={cafes}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
          />
        </KakaoMap>

        {/* key로 카페마다 새로 마운트해 사진 슬라이드를 첫 장으로 되돌린다 */}
        {selected && <CafeCard key={selected.id} cafe={selected} onClose={handleClose} />}
      </div>
    </main>
  );
}
