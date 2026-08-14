'use client';

import type { Cafe } from '@/types/cafe';
import CafeMarker from './CafeMarker';

interface CafeMarkersProps {
  cafes: Cafe[];
  /** 지금 열려 있는 카페의 id. 그 마커만 강조하고 위로 올린다 */
  selectedId: string | null;
  onSelect: (cafe: Cafe) => void;
}

/**
 * 카페 배열을 마커로 그린다.
 *
 * 마커 하나하나가 CustomOverlay + 포탈을 각자 들고 있어야 해서(CafeMarker 주석),
 * 여기서는 목록을 펼치기만 한다. DOM은 이 컴포넌트가 아니라 각 오버레이가 만든
 * 컨테이너에 들어간다.
 */
export default function CafeMarkers({ cafes, selectedId, onSelect }: CafeMarkersProps) {
  return (
    <>
      {cafes.map((cafe) => (
        <CafeMarker
          key={cafe.id}
          cafe={cafe}
          selected={cafe.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
