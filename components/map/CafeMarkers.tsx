'use client';

import { useEffect } from 'react';
import type { Cafe } from '@/types/cafe';
import { useKakaoMap } from './MapContext';

interface CafeMarkersProps {
  cafes: Cafe[];
  onSelect: (cafe: Cafe) => void;
}

/**
 * 카페 배열을 마커로 그린다.
 *
 * 카카오 SDK는 명령형이라 React의 선언형 렌더링 밖에 있다. 그래서 마커 생성·해제를
 * 이 컴포넌트의 useEffect 안에 가두고, DOM은 아무것도 렌더링하지 않는다.
 */
export default function CafeMarkers({ cafes, onSelect }: CafeMarkersProps) {
  const map = useKakaoMap();

  useEffect(() => {
    if (!map) return;

    const markers = cafes.map((cafe) => {
      const marker = new window.kakao.maps.Marker({
        map,
        position: new window.kakao.maps.LatLng(cafe.lat, cafe.lng),
        title: cafe.name,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => onSelect(cafe));
      return marker;
    });

    // 언마운트·데이터 변경 시 이전 마커를 반드시 지운다. 빠뜨리면 지도에 유령 마커가 남는다.
    return () => {
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [map, cafes, onSelect]);

  return null;
}
