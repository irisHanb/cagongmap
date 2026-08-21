/**
 * ★ 카카오맵 SDK 주소 — **한 곳에서만 만든다**
 *
 * ⚠️ **`window.kakao`는 문서당 하나뿐인 전역이다.** 그래서 화면마다 다른 `libraries`로
 * 스크립트를 넣어도 두 벌이 공존하지 않는다. 먼저 로드된 쪽이 이기고, 나중에 들어온
 * 스크립트는 `window.kakao`가 이미 있으면 조용히 아무 일도 하지 않는다.
 *
 * 2026-08-21에 이걸로 한 번 깨졌다. 관리자 폼만 `libraries=services`를 붙였는데,
 * 지도(`/`)에서 dock → 운영 화면 → 제보 승인으로 넘어오는 경로가 **전부 클라이언트
 * 내비게이션**이라 `/`가 먼저 불러 둔 services 없는 SDK가 그대로 남았다. 결과는
 * `Cannot read properties of undefined (reading 'Geocoder')`이고, 새로고침으로 관리자
 * 화면에 직접 들어가면 재현되지 않아 더 헷갈렸다.
 *
 * **그래서 공개 지도도 `services`를 달고 간다.** 대가는 지도를 여는 모든 방문자가
 * 쓰지 않는 지오코더 모듈을 함께 받는 것이다. 그 값을 치르는 이유는, 대안이 전부
 * "언제 어느 쪽이 먼저 로드됐는지"에 기대는 방법이라서다 — 그런 조건은 라우팅이
 * 한 줄 바뀌면 깨지고, 깨졌을 때 화면이 통째로 에러 경계로 떨어진다.
 *
 * `autoload=false`는 그대로다. 자동 로드에 맡기면 하이드레이션 시점과 어긋나
 * `kakao is not defined`가 산발적으로 난다.
 */
export const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false&libraries=services`;

/** 키가 없으면 지도를 그리지 않고 안내로 떨어진다. 의도된 폴백이다 */
export const HAS_KAKAO_KEY = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY);
