/**
 * 카카오맵 JS SDK 중 이 프로젝트에서 실제로 쓰는 부분만 최소로 선언한다.
 * 공식 타입 패키지가 없어 직접 정의하며, 쓰는 API가 늘면 여기에 추가한다.
 */
declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
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
    /** 화면 픽셀 단위로 지도를 옮긴다. dock이 가리는 만큼 중심을 보정할 때 쓴다 */
    panBy(dx: number, dy: number): void;
    relayout(): void;
    setLevel(level: number): void;
    getCenter(): LatLng;
  }

  /** 지도 클릭 콜백이 받는 것. 쓰는 것은 좌표 하나뿐이다 */
  interface MapMouseEvent {
    latLng: LatLng;
  }

  interface MarkerOptions {
    map?: Map;
    position: LatLng;
    title?: string;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
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
    // 인자를 받는 핸들러를 허용한다. 인자를 쓰지 않는 기존 호출부는 그대로 통과한다
    // (매개변수가 적은 함수는 많은 쪽에 대입할 수 있다).
    function addListener<E = void>(target: object, type: string, handler: (event: E) => void): void;
    function removeListener<E = void>(
      target: object,
      type: string,
      handler: (event: E) => void,
    ): void;
  }

  /**
   * `libraries=services`로 로드해야 존재한다.
   *
   * ⚠️ **런타임에는 없을 수 있다.** `window.kakao`가 문서당 하나뿐이라, 이 라이브러리
   * 없이 로드된 SDK가 먼저 전역에 올라와 있으면 `services`가 undefined다. 타입은
   * 그것을 표현하지 못하므로 **쓰는 쪽에서 존재를 확인한다**
   * (`app/admin/places/LocationPicker.tsx`). 주소를 한 곳에 모은 이유도 그것이다
   * (`lib/kakao-sdk.ts`).
   */
  namespace services {
    /** 문자열 상수다. 실제 값은 'OK' · 'ZERO_RESULT' · 'ERROR' */
    const Status: {
      OK: string;
      ZERO_RESULT: string;
      ERROR: string;
    };

    interface AddressSearchResult {
      /** 문자열로 온다. 숫자로 쓰려면 Number()를 거친다 */
      x: string;
      y: string;
      address_name: string;
    }

    interface Coord2AddressResult {
      road_address: { address_name: string } | null;
      address: { address_name: string } | null;
    }

    /**
     * 키워드 검색 결과 한 건.
     *
     * ⚠️ **`x`가 경도, `y`가 위도이고 둘 다 문자열이다.** LatLng 생성자는 (위도, 경도)
     * 순서에 숫자를 받으므로 그대로 넘기면 지구 반대편이 찍힌다.
     */
    interface PlacesSearchResult {
      id: string;
      place_name: string;
      /** 지번 주소. 도로명이 없는 곳이 있어 이쪽이 폴백이다 */
      address_name: string;
      /** 도로명 주소. 빈 문자열일 수 있다 */
      road_address_name: string;
      x: string;
      y: string;
      phone: string;
      place_url: string;
      category_name: string;
    }

    interface Pagination {
      totalCount: number;
      hasNextPage: boolean;
    }

    interface KeywordSearchOptions {
      /** 한 번에 받을 개수. 1~15 */
      size?: number;
      /** 이 지점 기준으로 찾는다. radius와 함께 써야 의미가 있다 */
      location?: LatLng;
      /** 미터. 카카오 상한이 20000이다 */
      radius?: number;
    }

    class Places {
      keywordSearch(
        keyword: string,
        callback: (
          data: PlacesSearchResult[],
          status: string,
          pagination: Pagination,
        ) => void,
        options?: KeywordSearchOptions,
      ): void;
    }

    class Geocoder {
      addressSearch(
        address: string,
        callback: (result: AddressSearchResult[], status: string) => void,
      ): void;
      /** ⚠️ 인자 순서가 (경도, 위도)다. LatLng과 반대라 바꿔 넣기 쉽다 */
      coord2Address(
        lng: number,
        lat: number,
        callback: (result: Coord2AddressResult[], status: string) => void,
      ): void;
    }
  }

  /** autoload=false로 로드했을 때 SDK 초기화를 실행하는 진입점 */
  function load(callback: () => void): void;
}

interface Window {
  kakao: typeof kakao;
}
