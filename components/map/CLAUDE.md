# 카카오맵 SDK

명령형 SDK를 React에 붙이는 부분이라 규칙이 몇 가지 있다.
`types/kakao.d.ts`는 **직접 작성한 최소 선언**이다. 공식 타입 패키지가 없으므로,
새 SDK API를 쓰면 거기에 먼저 추가해야 한다.

## SDK 주소는 `lib/kakao-sdk.ts` 하나에서 나온다

**화면마다 다른 URL을 쓰지 않는다.** `window.kakao`는 **문서당 하나뿐인 전역**이라
두 벌이 공존하지 않는다 — 먼저 로드된 쪽이 이기고, 나중 스크립트는 `window.kakao`가
이미 있으면 조용히 아무 일도 하지 않는다.

- 2026-08-21에 이걸로 깨졌다. 관리자 폼에만 `libraries=services`를 붙였는데,
  지도(`/`) → dock → 운영 화면 → 제보 승인이 **전부 클라이언트 내비게이션**이라
  `/`가 먼저 불러 둔 services 없는 SDK가 남았다. 결과는
  `Cannot read properties of undefined (reading 'Geocoder')`이고,
  **관리자 주소로 직접 들어가면 재현되지 않아** 더 헷갈렸다.
- 그래서 **공개 지도도 `libraries=services`를 달고 간다.** 지오코더를 쓰지 않는
  방문자도 함께 받는 것이 대가다. 그 값을 치르는 이유는 대안이 전부 "언제 어느 쪽이
  먼저 로드됐는지"에 기대는 방법이고, 그런 조건은 라우팅 한 줄에 깨지기 때문이다.
- 그럼에도 **쓰는 쪽에서 `services`의 존재를 확인한다.** 타입에는 항상 있는 것처럼
  보이지만 런타임 보장은 없다. 없으면 주소 검색만 접고 지도는 살린다
  (`app/admin/places/LocationPicker.tsx`).

## 초기화

- **`autoload=false`로 로드하고 `kakao.maps.load()` 콜백 안에서 지도를 만든다.**
  자동 로드에 맡기면 하이드레이션 시점과 어긋나 `kakao is not defined`가 산발적으로
  발생한다.
- **`next/script`는 `layout.tsx`가 아니라 `KakaoMap.tsx` 안에 있다.** `onReady`로
  초기화 시점을 잡아야 해서 스크립트와 지도 생성 코드가 같은 클라이언트 컴포넌트에
  있어야 한다.
- **`MapContext`**가 생성된 지도 인스턴스를 하위로 전달한다. `KakaoMap`이 자식을 알지
  않아도 되게 하려는 것이다.

## 마커

- **기본 `Marker`가 아니라 `CustomOverlay` + `createPortal`이다**(`CafeMarker`). 대표
  사진을 원형으로 자르고 테두리를 두르려면 HTML이어야 한다. `MarkerImage`는 이미지를
  아이콘에 그대로 얹을 뿐이라 크롭이 안 된다.
- **어느 쪽이든 cleanup에서 `setMap(null)`을 반드시 호출한다.** 빠뜨리면 유령 마커가 남는다.
- **포탈 컨테이너는 `useEffect`에서 만든다.** 게으른 초기화로 만들면 서버는 `null`,
  클라이언트는 포탈을 내놓아 하이드레이션이 깨진다. 마커는 항상 렌더되므로 이 차이가
  매번 드러난다.
- **선택된 마커를 위로 올릴 때는 `overlay.setZIndex()`를 쓴다.** 오버레이마다 SDK가
  별도 wrapper를 만들기 때문에 CSS `z-index`로는 형제 마커를 넘지 못한다.
- **`onSelect`는 `useCallback`으로 참조를 고정한다**(`MapView`). 안 하면 렌더마다
  마커를 전부 지웠다 다시 만든다.

## Map Shell

**지도는 `100dvh` 풀스크린이고 나머지 UI는 전부 그 위에 뜬다**(`DESIGN.md` — Map Shell).
dock도 상세 패널도 지도 크기를 바꾸지 않으므로 `relayout()`을 부를 일이 없다.
패널이 지도를 미는 구조로 되돌리면 `relayout` 감시가 다시 필요해진다.

- `MapCenterInset`이 지도 중심을 "가려지지 않은 영역"의 중심으로 옮긴다. 좁은 화면에서
  dock이 가로를 거의 다 덮으면 뷰포트 중심(송리단길)이 카드 뒤에 깔려 마커가 한 개도
  보이지 않기 때문이다. 데스크톱에서는 dock이 왼쪽 390px만 쓰므로 아무것도 하지 않는다.
