# Core Web Vitals 측정 — https://cagongmap-nu.vercel.app/

**측정 방법: Lab data만입니다.** Google API credential이 없어 PSI API가 rate limit
(`PSI rate limit exceeded (240 QPM / 25,000 QPD)`)으로 막혔고, CrUX field data도
없습니다(사이트가 `noindex`라 실 트래픽이 없어 애초에 CrUX 자료가 없을 사이트이기도
합니다). 아래 수치는 로컬 Lighthouse 13.4.1 CLI(`npx lighthouse`, mobile emulation,
기본 simulated throttling = Slow 4G급 네트워크 + 4x CPU slowdown) 1회 실행 결과입니다.
Lab 단발 측정이라 75th percentile 판정(CrUX 기준)은 내릴 수 없고, "Good/Needs
improvement/Poor" 임계값과 비교만 합니다.

Lighthouse 원본 JSON(578KB)은 저장소에 넣지 않았다. 아래 명령으로 다시 만들 수 있다.

```bash
# mobile emulation + simulated throttling은 Lighthouse 기본값이다
npx lighthouse https://cagongmap-nu.vercel.app/ \
  --only-categories=performance --output=json --output-path=lh-mobile.json
```

## 요약

| Metric | 값 (lab, mobile simulated) | 판정 |
|---|---|---|
| Performance score | 70 / 100 | — |
| LCP | **7327ms** (simulated) / observed unthrottled 1127ms | simulated 기준 Poor (>4.0s) |
| CLS | **0** | Good (≤0.1) |
| INP | 측정 실패 (아래 설명) — 코드 검토로는 Good 가능성 높음 | 불확실, 실측 필요 |
| TBT (Total Blocking Time, INP의 대리 지표) | 26ms | 매우 낮음 |
| TTFB | 89.6ms(observed) / 600ms(simulated 포함) | Good |

## LCP — 이 지도 페이지에서 LCP element는 사진이 아니라 **카카오맵 raster tile PNG**입니다

Lighthouse의 `largest-contentful-paint-element`/`lcp-breakdown-insight`가 지목한
LCP element는 마커 사진도 브랜드 텍스트도 아니고, 카카오맵 SDK가 그리는 지도
타일 이미지입니다.

```
<img src="https://mts.daumcdn.net/api/v1/tile/PNG02/v22_ydigb/latest/5/492/233.png" ...>
selector: div > div > div > img   (지도 컨테이너 안, KakaoMap이 만드는 DOM)
```

LCP subpart breakdown (observed, unthrottled trace 기준):

| Subpart | Duration |
|---|---|
| Time to First Byte | 89.6ms |
| Resource load delay | 374.5ms |
| Resource load duration | 115.4ms |
| Element render delay | 547.9ms |
| **합 (observed LCP)** | **1127ms** |

- Simulated(기본 mobile throttling) 기준 LCP = **7327ms**로 Poor 문턱(4.0s)을 크게
  넘습니다. 하지만 observed(실측, 스로틀 없음) 기준은 1127ms로 Good입니다. 이 큰 간극은
  카카오맵 타일이 하나가 아니라 **12장**(뷰포트를 채우기 위한 격자 타일)이고, 이 12장이
  모두 로드된 뒤에야 화면에서 가장 큰 요소가 확정되기 때문입니다 — Slow 4G 시뮬레이션에서는
  12장 순차/병렬 로드 자체가 느려집니다.
- `lcp-discovery-insight` 체크리스트: `requestDiscoverable: false`,
  `priorityHinted: false`. 지도 타일 URL은 카카오 SDK가 JS로 계산해서 요청하므로
  **초기 HTML에서 미리 알 수 없고**(preload 불가), `fetchpriority=high`도 붙어 있지
  않습니다. 이것이 "third-party SDK가 콘텐츠 첫 페인트를 막는다"는 이 페이지의
  근본적인 성능 특성입니다 — LCP가 카카오 SDK의 로드 → 초기화 → 타일 요청 체인
  전체에 종속돼 있습니다.
- Render-blocking 리소스: `_next/static/.../1txcyg2mbgy0-.css` (17.9KB, 319ms
  wasted) 하나뿐입니다. Next.js 자체 CSS라 심각하지 않습니다.

**개선 방향(영향 큰 순)**

1. **카카오맵 SDK/타일 로드 경로를 앞당길 수 있는 부분만 앞당깁니다.** SDK 스크립트
   자체(`dapi.kakao.com/.../sdk.js`)에 `<link rel="preconnect">` 또는
   `dns-prefetch`를 `mts.daumcdn.net`, `t1.daumcdn.net`, `dapi.kakao.com`에 걸어
   두면 DNS/TLS 협상을 초기 HTML 파싱과 병렬로 시작할 수 있습니다. `resourceLoadDelay`
   374ms가 이 구간입니다.
2. **LCP 대상 자체를 지도 타일에서 다른 요소로 옮기는 것은 구조상 어렵습니다.**
   지도가 `100dvh` 풀스크린이라 뷰포트 대부분을 지도 타일이 차지하기 때문에,
   콘텐츠(브랜드 텍스트, 카드)가 아무리 빨리 그려져도 픽셀 면적상 지도 타일이
   LCP 후보로 이길 가능성이 높습니다. 대신 **지각 성능**을 개선하는 방향 —
   지도 컨테이너에 배경색이나 저해상도 placeholder를 깔아 두면 실제 LCP 시각은
   그대로여도 "빈 화면" 체감 시간이 줄어듭니다.
3. `element render delay` 548ms은 12개 타일이 모두 도착한 뒤 브라우저가 합성하는
   시간입니다. 초기 줌 레벨(`level=5`, `MapView.tsx`)에서 필요한 타일 수를 줄이는
   것은 지도 UX와 트레이드오프라 우선순위는 낮게 둡니다.

## CLS — 0, 문제 없음

`cumulative-layout-shift` = **0**, `cls-culprits-insight` 항목도 빈 리스트입니다.
마커 포탈이 마운트되는 시점의 레이아웃 시프트는 관측되지 않았습니다. 이유는 코드
구조에 있습니다.

- `CafeMarker.tsx`가 마커 DOM 노드를 `useState` lazy init으로 **한 번만** 만들고,
  포탈 마운트는 `useSyncExternalStore`로 하이드레이션 완료 여부만 구독합니다 —
  effect에서 `setState`를 거쳐 순차로 나타나는 구조가 아니라서 여러 프레임에
  걸친 튀는 삽입이 없습니다.
- 마커는 카카오 SDK `CustomOverlay`(`position: absolute`, 지도 좌표계) 안에
  그려지므로애초에 **문서 흐름(document flow)에 영향을 주지 않습니다.** 다른
  요소를 밀어내는 시프트가 구조적으로 발생하기 어렵습니다.
- 마커 사진(`next/image`, `width=96 height=96`)에 명시적 치수가 있어 이미지
  로드로 인한 시프트도 없습니다.

리스크가 남아있는 지점은 실측하지 않았지만: 상세 패널(`CafeCard`)이 열릴 때
지도 크기 자체는 안 바뀌지만(`relayout()` 안 부름, CLAUDE.md 확인), 패널이
지도 위에 얹히는 오버레이 방식이라 CLS에는 영향이 없을 것으로 보입니다 — 이 부분은
정적 홈페이지 로드 측정에는 포함되지 않았습니다.

## INP — 측정 실패, 코드 검토 기반 추정만 가능

Lighthouse의 `inp-breakdown-insight`가 `undefined`로 돌아왔습니다. **일반 네비게이션
lab trace는 사용자 상호작용이 없어서 INP를 산출하지 못합니다** — INP는 정의상
실제 interaction(click/tap/key)이 있어야 계산되는 지표라서, 단순 페이지 로드
측정으로는 얻을 수 없습니다. 마커를 클릭하는 실제 interaction trace(Lighthouse
user-flow 또는 CDP 기반 실측)는 이번 세션에서 별도로 캡처하지 못했습니다 — 이 부분은
미실측이라고 명시합니다.

대신 아래 두 대리 지표(proxy)와 코드 검토로 근거를 제시합니다.

- **TBT (Total Blocking Time) = 26ms**, **Max Potential FID 계열 지표 = 76ms**
  (참고용 legacy 수치, INP 대체 확정 이후로는 참고만). 메인스레드 점유가 매우
  낮아 첫 interaction 응답 지연 위험이 낮습니다.
- **Main-thread work breakdown**: Script Evaluation 204ms, Style & Layout 94ms,
  Script Parse/Compile 61ms — 전부 페이지 로드 전체 합산 수치이고, 개별 클릭
  핸들러가 이 중 큰 덩어리를 차지하지 않습니다.
- `components/map/MapView.tsx`의 `handleSelect = useCallback((cafe) =>
  setSelected(cafe), [])`는 **`panTo`나 지도 애니메이션을 트리거하지 않고** 단순
  React state 갱신 후 `CafeCard` 오버레이를 여는 것이 전부입니다. 지도 재배치나
  DOM 재생성이 없어 클릭 → 다음 페인트 사이에 무거운 작업이 낄 여지가 구조적으로
  작습니다.
- DOM size가 **75 elements**(Optimize DOM size insight)로 1,500 threshold에
  한참 못 미쳐, 이벤트 위임/스타일 재계산 비용도 낮습니다.

**결론(추정)**: 코드 구조와 TBT 수치로 볼 때 INP는 Good(≤200ms) 범위에 들 가능성이
높지만, **실측치가 아니므로 확정할 수 없습니다.** 실 서비스로 배포해 CrUX field
data가 쌓이거나, Playwright/CDP로 마커 클릭 interaction trace를 직접 캡처해야
확정 수치를 얻을 수 있습니다.

## 카카오맵 SDK 비용

| 리소스 | Transfer size | Main thread time |
|---|---|---|
| `t1.daumcdn.net/mapjsapi/js/main/4.5.26/kakao.js` | 35.1KB | 3.26ms |
| `dapi.kakao.com/v2/maps/sdk.js` (loader, autoload=false) | 1.6KB | — |
| 지도 타일 PNG 12장 (`mts.daumcdn.net/.../tile/...`) | 약 715KB (평균 타일 55~65KB) | ~0ms (디코딩은 rendering 버킷) |
| 기타 SDK 리소스(배경 타일, 아이콘, 투명 gif) | ~6KB | — |
| **Kakao 서드파티 합계** (`third-parties-insight`) | **873.5KB** | 3.26ms |

- SDK 스크립트 자체의 실행 비용은 낮습니다(main thread 3.26ms) — 스크립트
  파싱/실행이 문제가 아니라 **타일 이미지 다운로드 체인이 문제**입니다.
- 페이지 전체 이미지 무게(847.7KB, 23 requests) 중 **대부분이 카카오 지도
  타일**입니다(12장 × 평균 60KB ≈ 715KB). Supabase 카페 사진은 6장 로드되어
  1.1~3.3KB씩(next/image가 96px, q=75로 리사이즈) — 총 10KB 미만입니다.
  → **이미지 weight 최적화 여지는 카카오 타일 쪽에 없습니다(SDK가 서빙하는
  포맷/사이즈를 우리가 바꿀 수 없음)**. Supabase 쪽은 이미 잘 최적화돼 있습니다.
- `image-delivery-insight`가 지목한 유일한 낭비는 카카오 타일입니다 —
  `naruteo` 등 카페 사진이 아니라 `tile/PNG02/.../492/234.png` 같은 지도 타일에
  대해 "modern format(WebP/AVIF) 사용, 512x512 표시 대비 과대 사이즈" 지적이
  달렸습니다. 이건 카카오 서버가 내려주는 리소스라 **우리 쪽에서 수정 불가능한
  항목**입니다.

## Supabase 이미지 (`next/image` 사용 여부)

**확인 결과: 카페 마커 사진은 `next/image`를 정상적으로 통과하고 있습니다.**
`CafeMarker.tsx`가 `next/image`의 `<Image>`를 쓰고, 실제 요청 URL도
`/_next/image?url=https%3A%2F%2Fpalzceynjixnbqjsagpq.supabase.co%2F...&w=96&q=75`
형태로 Next 이미지 최적화 파이프라인을 거칩니다. DOM에서도 `data-nimg="1"`,
`srcset`, `sizes="48px"`, `loading="lazy"`가 확인됩니다.

- 결과물 크기: manarang 1.1KB, howp 2.0KB, naruteo 1.5KB, starbucks_jamsil
  3.3KB, starbucks_lake 1.4KB — 마커 썸네일(48px 표시)치고 충분히 작습니다.
- CLAUDE.md에 적힌 대로 **카카오 avatar만 `next/image`를 의도적으로 우회**하고,
  카페 사진(Supabase Storage 원본)은 이 페이지 로드 시점에는 전부 `next/image`를
  거칩니다 — 이번 측정에서 우회 사례는 발견되지 않았습니다. (단, `CafeCard`
  상세 패널 안의 사진 슬라이드는 지도 초기 로드 측정 범위 밖이라 별도 확인이
  필요합니다.)

## 리소스 총량

| 항목 | 값 |
|---|---|
| 총 요청 수 | 46 |
| 총 transfer size | 1,322.8KB (약 1.29MB) |
| Image | 847.7KB (23 requests) — 대부분 카카오 타일 |
| Script | 266.4KB (13 requests) — Next 청크 + 카카오 SDK |
| Font | 185.0KB (7 requests) — Pretendard variable subset |
| Stylesheet | 17.9KB (1 request) |
| Document (HTML) | 4.7KB |
| Third-party 합계 | 875.1KB (20 requests) — 사실상 전부 카카오 |

폰트 7개(38.3/21.1/24.8/22.1/25.9/26.0/26.8KB, 합 185KB)는 Pretendard variable의
dynamic subset이라 사용된 글자만 내려받는 구조입니다. 초기 로드에 필요한 subset
수가 많아 보이지만(7개), 이는 이미 subset 최적화가 적용된 결과값입니다.

## 우선순위별 권고

1. **(중간 영향, 낮은 비용) `mts.daumcdn.net`, `t1.daumcdn.net`,
   `dapi.kakao.com`에 `<link rel="preconnect">`를 추가합니다.** LCP subpart 중
   `resourceLoadDelay`(374ms, observed 기준)를 줄이는 가장 직접적인 방법입니다.
   `KakaoMap.tsx`가 이미 `next/script`를 쓰고 있으니 `app/layout.tsx`의 `<head>`에
   preconnect 태그만 추가하면 됩니다.
2. **(낮은 영향, 낮은 비용) 지도 컨테이너에 로딩 중 placeholder 배경색을 깔아
   지각 성능을 개선합니다.** LCP 수치 자체는 안 바뀌지만 "빈 화면" 체감을
   줄입니다.
3. **(정보성) INP 실측치를 확보하려면 다음 감사에서 실제 interaction trace
   (Lighthouse user-flow 또는 CDP Performance timeline으로 마커 클릭 캡처)를
   포함해야 합니다.** 이번 측정에서는 정적 로드 trace만 가능했습니다.
4. **카카오 타일 이미지 최적화는 우리 쪽 조치 대상이 아닙니다.** 서드파티 SDK가
   서빙하는 리소스라 포맷/압축을 바꿀 수 없습니다 — 이 항목을 백로그에 넣지
   않습니다.
5. **Supabase/next/image 경로는 이미 잘 동작하고 있어 추가 조치가 필요 없습니다.**
   (CafeCard 상세 패널 사진 슬라이드는 이번 측정 범위 밖이라 별도 확인 권장.)

## 측정 한계 (명시)

- PSI API: rate limit로 실패, field data 없음.
- CrUX: credential 없음 + 사이트가 `noindex`라 실 트래픽 자체가 없어 field data
  존재 가능성 자체가 낮음.
- Lighthouse 실행 1회, mobile emulation + 기본 simulated throttling. 반복 측정
  평균이 아니므로 변동폭을 반영하지 못합니다.
- INP: 위에서 설명한 대로 실측 실패, 대리 지표(TBT)와 코드 검토로만 추정.
- CafeCard 상세 패널을 연 이후 상태(사진 슬라이드, 리뷰 섹션)는 이번 측정에
  포함되지 않았습니다 — 홈 로드 시점 trace만 캡처했습니다.
