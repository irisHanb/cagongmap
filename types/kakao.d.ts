/**
 * 카카오맵 JS SDK 중 이 프로젝트에서 실제로 쓰는 부분만 최소로 선언한다.
 * 공식 타입 패키지가 없어 직접 정의하며, 쓰는 API가 늘면 여기에 추가한다.
 */
declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
  }

  interface MapOptions {
    center: LatLng;
    level?: number;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setBounds(bounds: LatLngBounds): void;
    setCenter(latlng: LatLng): void;
    relayout(): void;
  }

  interface MarkerOptions {
    map?: Map;
    position: LatLng;
    title?: string;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
  }

  interface CustomOverlayOptions {
    map?: Map;
    position: LatLng;
    content: HTMLElement | string;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
    setZIndex(zIndex: number): void;
  }

  namespace event {
    function addListener(target: object, type: string, handler: () => void): void;
    function removeListener(target: object, type: string, handler: () => void): void;
  }

  /** autoload=false로 로드했을 때 SDK 초기화를 실행하는 진입점 */
  function load(callback: () => void): void;
}

interface Window {
  kakao: typeof kakao;
}
