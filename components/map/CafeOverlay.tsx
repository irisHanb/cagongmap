'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Cafe } from '@/types/cafe';
import CafeCard from '@/components/cafe/CafeCard';
import { useKakaoMap } from './MapContext';

/** 카드와 지도 가장자리 사이에 남길 여백 */
const EDGE_MARGIN = 16;

interface CafeOverlayProps {
  cafe: Cafe | null;
  onClose: () => void;
}

/**
 * 선택된 카페 카드를 마커 바로 위에 띄운다.
 *
 * 화면 구석에 고정하지 않고 CustomOverlay에 얹는 이유는 지도를 끌거나 확대해도
 * 카드가 마커를 계속 따라가야 하기 때문이다. 좌표를 화면 좌표로 직접 변환하면
 * pan·zoom 이벤트를 모두 따라다녀야 하는데, 그건 SDK가 이미 하는 일이다.
 *
 * CafeMarkers와 마찬가지로 명령형 SDK 호출을 useEffect 안에 가두고, 카드 자체는
 * createPortal로 오버레이 DOM에 꽂아 React가 계속 그리게 둔다.
 */
export default function CafeOverlay({ cafe, onClose }: CafeOverlayProps) {
  const map = useKakaoMap();

  // 카드를 담을 DOM은 한 번만 만들어 계속 재사용한다. 카페가 바뀔 때마다 만들어
  // state에 넣으면 effect 안에서 setState하는 꼴이 되고, ref로 두면 렌더 중에
  // ref를 읽게 된다. 게으른 초기화가 둘 다 피한다. (서버 렌더에서는 null)
  const [node] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = 'cafe-overlay';
    return el;
  });

  useEffect(() => {
    if (!map || !cafe || !node) return;

    const overlay = new window.kakao.maps.CustomOverlay({
      map,
      content: node,
      position: new window.kakao.maps.LatLng(cafe.lat, cafe.lng),
      // 앵커를 SDK에 맡기지 않고 좌표에 좌상단만 맞춘 뒤, 나머지는 .cafe-overlay의
      // transform으로 잡는다. yAnchor는 오버레이를 만드는 순간의 내용 크기로
      // 계산되는데, 그 크기는 카드가 언제 그려지느냐에 따라 달라진다.
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 3,
      // 없으면 카드 안의 닫기 버튼과 링크 클릭이 지도로 흘러간다.
      clickable: true,
    });

    // 가장자리 마커를 누르면 카드가 지도 밖으로 잘린다(마커가 왼쪽 끝에 있으면
    // 카드 절반이 화면 밖으로 나간다). 잘린 만큼 카드를 지도 안쪽으로 밀어 넣는다.
    //
    // 지도를 움직이지 않고 카드만 옮기는 쪽을 택했다. 사용자가 보던 지도가 클릭
    // 한 번에 미끄러지지 않고, 꼬리는 .cafe-overlay에 붙어 있어 카드를 밀어도
    // 계속 마커를 가리킨다.
    //
    // 카드가 실제로 그려진 뒤에 재야 하므로 다음 프레임으로 미룬다.
    const frame = requestAnimationFrame(() => {
      const card = node.firstElementChild;
      const viewport = node.closest('.map-container');
      if (!(card instanceof HTMLElement) || !viewport) return;

      // node는 카페가 바뀌어도 재사용되므로 지난번 보정을 먼저 지운다.
      node.classList.remove('cafe-overlay--below');
      card.style.setProperty('--shift-x', '0px');

      const v = viewport.getBoundingClientRect();

      // 위쪽에 자리가 없으면 마커 아래로 뒤집는다.
      if (card.getBoundingClientRect().top < v.top + EDGE_MARGIN) {
        node.classList.add('cafe-overlay--below');
      }

      // 뒤집은 뒤 다시 재서 좌우로 밀어 넣는다.
      const c = card.getBoundingClientRect();
      let shiftX = 0;
      if (c.left < v.left + EDGE_MARGIN) shiftX = v.left + EDGE_MARGIN - c.left;
      else if (c.right > v.right - EDGE_MARGIN) shiftX = v.right - EDGE_MARGIN - c.right;

      if (shiftX !== 0) card.style.setProperty('--shift-x', `${Math.round(shiftX)}px`);
    });

    // 마커를 바꿔 누르면 이 정리가 먼저 돈다. 빠뜨리면 이전 카드가 지도에 남는다.
    return () => {
      cancelAnimationFrame(frame);
      overlay.setMap(null);
    };
  }, [map, cafe, node]);

  if (!cafe || !node) return null;

  return createPortal(<CafeCard cafe={cafe} onClose={onClose} />, node);
}
