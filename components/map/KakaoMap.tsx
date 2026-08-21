'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KAKAO_SDK_URL } from '@/lib/kakao-sdk';
import { MapContext } from './MapContext';

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
 *
 * ⚠️ 스크립트 주소는 `lib/kakao-sdk.ts`에서 온다. 여기서 직접 만들지 않는다 —
 *    `window.kakao`가 문서당 하나뿐이라 관리자 폼과 **같은 URL이어야** 한다
 *    (그 파일의 주석 참고).
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
      <Script src={KAKAO_SDK_URL} strategy="afterInteractive" onReady={initMap} />
      <div ref={containerRef} className="map-container" />
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </>
  );
}
