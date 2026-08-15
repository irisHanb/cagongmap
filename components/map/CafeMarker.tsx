'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Cafe } from '@/types/cafe';
import { WORK_FIT_LABEL } from '@/types/cafe';
import { useKakaoMap } from './MapContext';

/** useSyncExternalStore용 — 값이 바뀌지 않으므로 구독할 것이 없다 */
const subscribeNothing = () => () => {};

interface CafeMarkerProps {
  cafe: Cafe;
  selected: boolean;
  onSelect: (cafe: Cafe) => void;
}

/**
 * 카페 한 곳의 마커.
 *
 * SDK 기본 Marker 대신 CustomOverlay를 쓴다. 기본 Marker는 MarkerImage로 이미지
 * URL을 아이콘에 그대로 얹기만 해서 원형 크롭도 테두리도 안 된다. HTML로 그리면
 * 사진을 동그랗게 자르고 선택 상태도 CSS로 표현할 수 있다.
 *
 * 테두리 색은 work_fit에서 온다 (DESIGN.md — Map Marker). 색만으로 뜻을 전달하면
 * 안 되므로 같은 값을 title·aria-label에도 글로 넣는다.
 *
 * 오버레이가 만든 DOM 안에 createPortal로 React를 꽂아, 마커 내용은 계속 React가
 * 그린다. next/image를 그대로 쓸 수 있는 것도 이 때문이다 — 원본이 4MB대라
 * 최적화 없이 얹으면 마커 아홉 개에 수십 MB를 내려받는다.
 */
export default function CafeMarker({ cafe, selected, onSelect }: CafeMarkerProps) {
  const map = useKakaoMap();

  // 마커를 담을 DOM은 한 번만 만들어 계속 재사용한다. (서버 렌더에서는 null)
  const [node] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = 'cafe-marker-anchor';
    return el;
  });

  // 포탈은 하이드레이션이 끝난 뒤에만 그린다.
  //
  // 서버는 아무것도 못 내놓는데 클라이언트가 첫 렌더부터 포탈을 만들면 트리가
  // 어긋난다. 마커는 선택 여부와 무관하게 항상 렌더되므로 이 차이가 매번 드러난다.
  // effect에서 setState하는 대신 useSyncExternalStore로 "클라이언트인가"를 읽는다.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const overlayRef = useRef<kakao.maps.CustomOverlay | null>(null);

  useEffect(() => {
    if (!map || !node) return;

    const overlay = new window.kakao.maps.CustomOverlay({
      map,
      content: node,
      position: new window.kakao.maps.LatLng(cafe.lat, cafe.lng),
      // 앵커를 SDK에 맡기지 않는다. yAnchor는 오버레이를 만드는 순간의 내용 크기로
      // 계산되는데, 그 시점엔 포탈이 아직 아무것도 그리지 않아 크기가 0이다.
      // 좌상단만 좌표에 맞추고 나머지는 .cafe-marker-anchor의 transform이 잡는다.
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 1,
      // 없으면 마커 클릭이 지도로 흘러간다.
      clickable: true,
    });
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, node, cafe.lat, cafe.lng]);

  // 선택된 마커를 이웃 위로 올린다. 오버레이는 각자 별도 wrapper에 들어가므로
  // CSS z-index로는 형제 마커를 넘지 못하고, SDK에 직접 알려야 한다.
  useEffect(() => {
    overlayRef.current?.setZIndex(selected ? 3 : 1);
  }, [selected]);

  if (!node || !hydrated) return null;

  const photo = cafe.photos[0];
  const workFit = WORK_FIT_LABEL[cafe.work_fit];

  return createPortal(
    <button
      type="button"
      className={`cafe-marker cafe-marker--${cafe.work_fit}${
        selected ? ' cafe-marker--selected' : ''
      }`}
      onClick={() => onSelect(cafe)}
      title={`${cafe.name} · ${workFit}`}
      aria-label={`${cafe.name}, ${workFit} — 상세 보기`}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={96}
          height={96}
          sizes="48px"
          className="cafe-marker__photo"
        />
      ) : (
        // 사진이 없는 카페 — 같은 모양의 빈 핀으로 떨어뜨린다.
        <span className="cafe-marker__blank" aria-hidden="true" />
      )}
    </button>,
    node,
  );
}
