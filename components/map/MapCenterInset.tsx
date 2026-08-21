'use client';

import { useEffect, type RefObject } from 'react';
import { useKakaoMap } from './MapContext';

interface MapCenterInsetProps {
  /** 지도를 가리는 overlay. 지금은 brand-dock 하나뿐이다 */
  obstructionRef: RefObject<HTMLElement | null>;
}

/**
 * 지도 중심을 "가려지지 않은 영역"의 중심으로 옮긴다 (DESIGN.md — Map Shell).
 *
 * 좁은 화면에서 dock이 가로를 거의 다 덮으면, 뷰포트 중심(송리단길)이 카드 뒤에
 * 깔려 마커가 한 개도 안 보인다. 2026-08-21 SEO 감사의 P0가 그것이다
 * (docs/seo-audit-2026-08-21/seo-visual.md). 데스크톱에서는 dock이 왼쪽 390px만
 * 쓰므로 중심이 가려지지 않아 아무것도 하지 않는다.
 *
 * 중심 좌표 자체는 건드리지 않는다. "초기 중심은 송리단길"(scope.md)은 그대로 두고,
 * 그 지점이 실제로 보이는 자리에 오도록 화면을 픽셀만큼 민다.
 *
 * 지도 인스턴스에 직접 명령하는 컴포넌트라 DOM을 그리지 않는다. CafeMarker와 같은
 * 방식으로 MapContext에서 지도를 받는다.
 */
export default function MapCenterInset({ obstructionRef }: MapCenterInsetProps) {
  const map = useKakaoMap();

  useEffect(() => {
    const el = obstructionRef.current;
    if (!map || !el) return;

    const container = el.offsetParent as HTMLElement | null;
    if (!container) return;

    const dock = el.getBoundingClientRect();
    const view = container.getBoundingClientRect();

    // dock이 지도 중심 세로선을 넘지 않으면 중심은 이미 보인다. 데스크톱이 여기 걸린다.
    if (dock.right < view.left + view.width / 2) return;

    // 보이는 띠는 [dock 아래, 화면 아래]다. 그 띠의 중심은 뷰포트 중심보다
    // dockBottom/2 만큼 아래에 있다. 그만큼 화면을 밀어 올려 내용을 내린다.
    const shift = (dock.bottom - view.top) / 2;
    if (shift > 0) map.panBy(0, -shift);
    // 첫 화면을 잡는 일이라 지도가 준비된 순간 한 번만 한다. 이후 dock 높이가
    // 로그인·북마크로 바뀔 때마다 지도가 따라 움직이면 그게 더 거슬린다.
  }, [map, obstructionRef]);

  return null;
}
