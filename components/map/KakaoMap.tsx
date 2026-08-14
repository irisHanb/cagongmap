'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContext } from './MapContext';

const SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;

interface KakaoMapProps {
  center: { lat: number; lng: number };
  level?: number;
  children?: React.ReactNode;
}

/**
 * 카카오맵 SDK를 로드하고 지도 인스턴스를 만든다.
 *
 * autoload=false로 받아 kakao.maps.load() 콜백 안에서 초기화하는 것이 핵심이다.
 * 자동 로드에 맡기면 Next.js 하이드레이션 시점과 어긋나 'kakao is not defined'가
 * 산발적으로 발생한다. (docs/implementation-plan.md 4-1)
 */
export default function KakaoMap({ center, level = 5, children }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);

  const initMap = useCallback(() => {
    if (!containerRef.current || map) return;

    window.kakao.maps.load(() => {
      if (!containerRef.current) return;
      const instance = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level,
      });
      setMap(instance);
    });
  }, [center.lat, center.lng, level, map]);

  // Script가 이미 로드된 뒤 이 컴포넌트가 마운트되는 경우(라우팅 복귀 등) 대비
  useEffect(() => {
    if (!map && typeof window !== 'undefined' && window.kakao?.maps) {
      initMap();
    }
  }, [map, initMap]);

  // 상세 패널이 열리면 데스크톱에서 지도 폭이 줄어든다. 카카오맵은 컨테이너 크기를
  // 스스로 감시하지 않아서, 알려주지 않으면 타일이 잘린 채로 남는다.
  // 패널 상태를 여기까지 내려보내는 대신 컨테이너 크기를 직접 본다 — KakaoMap이
  // 자식이 무엇을 하는지 몰라도 되게 하려는 것이다.
  useEffect(() => {
    const container = containerRef.current;
    if (!map || !container) return;

    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className="map-error">
        <p>
          <strong>카카오맵 키가 없습니다.</strong>
        </p>
        <p>
          프로젝트 루트에 <code>.env.local</code>을 만들고{' '}
          <code>NEXT_PUBLIC_KAKAO_MAP_KEY</code>에 JavaScript 키를 넣어주세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <Script src={SDK_URL} strategy="afterInteractive" onReady={initMap} />
      <div ref={containerRef} className="map-container" />
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </>
  );
}
