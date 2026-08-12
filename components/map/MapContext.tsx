'use client';

import { createContext, useContext } from 'react';

/**
 * 생성된 카카오맵 인스턴스를 하위 컴포넌트에 전달한다.
 * 지도가 아직 준비되지 않았으면 null.
 */
export const MapContext = createContext<kakao.maps.Map | null>(null);

export function useKakaoMap() {
  return useContext(MapContext);
}
