# 카공맵 SEO 종합 감사

- **대상**: https://cagongmap-nu.vercel.app/
- **감사일**: 2026-08-21
- **방식**: claude-seo v2.2.4, 전문 에이전트 8개 병렬 (technical · content · schema · sitemap · performance · visual · geo · sxo)
- **제외**: seo-google(자격증명 없음), seo-drift(베이스라인 없음), seo-ecommerce·seo-local·seo-maps(해당 없음), seo-backlinks(신규 도메인 + noindex)

---

## SEO Health Score: 40 / 100

| 카테고리 | 점수 | 가중치 | 기여 | 출처 |
|---|---:|---:|---:|---|
| Technical SEO | 58 | 22% | 12.8 | seo-technical |
| Content Quality | 28 | 23% | 6.4 | seo-content |
| On-Page SEO | 45 | 20% | 9.0 | 오케스트레이터 판정 |
| Schema / 구조화 데이터 | 0 | 10% | 0.0 | seo-schema |
| Performance (CWV) | 70 | 10% | 7.0 | Lighthouse 13.4.1 lab |
| AI Search Readiness | 10 | 10% | 1.0 | seo-geo |
| Images | 70 | 5% | 3.5 | 오케스트레이터 판정 |
| **합계** | | | **39.7 → 40** | |

> On-Page와 Images는 전담 에이전트를 돌리지 않아 오케스트레이터가 관측값으로 매긴 추정치다.
> Performance는 **lab data뿐**이다. noindex라 트래픽이 없어 CrUX field data가 애초에 존재하지 않는다.

---

## 1. PERCEIVE — 관측된 사실

직접 확인한 값만 적는다.

| 항목 | 값 |
|---|---|
| HTTP | 200, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300` |
| HTTPS | 308 리다이렉트 1홉, HSTS `max-age=63072000; includeSubDomains; preload` |
| `lang` | `ko` |
| canonical | `https://cagongmap-nu.vercel.app` (트레일링 슬래시 없음) |
| h1 | `카공맵` (1개) |
| h2 | **0개** |
| robots meta | **`noindex, nofollow`** |
| robots.txt | `User-Agent: * / Allow: /` — AI 크롤러 전부 통과 |
| sitemap.xml | **404** |
| JSON-LD | **0개** |
| **서버 렌더 body 텍스트** | **46자** |
| og:image | 200, PNG 1200×630, 43KB — 한글·줄바꿈 정상 |
| favicon / icon.svg / apple-icon | 셋 다 200 |
| 보안 헤더 | HSTS **하나뿐** |
| 지도 프로덕션 렌더 | **정상** (vercel.app 도메인이 카카오 콘솔에 등록돼 있음) |

서버가 렌더한 body 텍스트 전문:

```
WORK CAFE MAP 카공맵 오래 앉아 작업하기 좋은 카페 9 곳 카페 제보하기
```

---

## 2. ANALYZE — 발견이 하나로 수렴한다

에이전트 8개가 서로 다른 각도에서 들어갔는데 결론이 한 점에서 만난다.

```
                    ┌─────────────────────────────────────┐
    근본 원인 ①      │ 카페 데이터가 클라이언트에서만 렌더된다  │
                    └─────────────────┬───────────────────┘
                                      │
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
   Content 28     Schema 0       GEO 10       SXO 20      sitemap 무의미
   본문 없음      마크업할        인용할        랭킹할       URL이 하나뿐
                 콘텐츠 없음     문장 없음     페이지 타입 아님

                    ┌─────────────────────────────────────┐
    근본 원인 ②      │ noindex (사진 9장 이용 권리 미확인)     │
                    └─────────────────┬───────────────────┘
                                      │
                          위 전부를 지금은 무효화한다
```

**근본 원인 ①.** 카페 9곳 데이터는 HTML 안에 실제로 있다. 다만 `self.__next_f.push(...)` RSC
flight payload의 escape된 JSON 문자열로만 있다. `<script>` 안의 직렬화 데이터이므로 trafilatura
같은 본문 추출기는 버리고, Google도 콘텐츠로 취급하지 않는다. `CafeMarker.tsx`를 보면 카페 이름은
`<button title=… aria-label=…>` 속성에만 있고 가시 텍스트 노드가 없다. 그 버튼조차 Kakao SDK 로드
→ `kakao.maps.load()` → `CustomOverlay` 생성 → `createPortal`까지 끝나야 나타난다.

결과: **"송파", "잠실", "콘센트", 카페 이름 어느 것도 페이지 텍스트에 없다.** noindex를 오늘 풀어도
검색 의도 키워드가 0개인 페이지가 색인될 뿐이다.

**근본 원인 ②.** `robots: { index: false }`는 의도된 결정이다(`mvp-decisions.md`). 사진 9장의 이용
권리가 미확인이라 걸어둔 것이고, `robots.txt`를 전부 허용으로 둔 것도 의도다 — 슬랙·카카오톡 링크
펼치기 봇이 OG 카드를 가져가야 하기 때문이다. 이 감사는 그것을 버그로 보지 않는다.

**두 원인의 순서가 중요하다.** ②가 풀리기 전에는 ①을 고쳐도 검색 노출이 0이다. 반대로 ②만 풀고
①을 안 고치면 46자짜리 페이지가 색인된다. 그런데 ①은 지금 고쳐도 손해가 없고, ②는 SEO 문제가
아니라 **사진 출처 결정**이다.

### 크롤러 접근성 비대칭

`robots.txt`는 GPTBot·OAI-SearchBot·ClaudeBot·PerplexityBot을 전부 통과시키는데(UA 스푸핑 확인,
동일한 200), noindex 메타는 모든 UA에 똑같이 붙는다.

- **확실히 배제**: Google AI Overviews, Bing Copilot — 자사 검색 인덱스에서 grounding하므로 noindex가 배제시킨다.
- **바이트는 수집 가능**: GPTBot·ClaudeBot 등 학습용 크롤러는 noindex를 인덱싱 신호로만 취급한다.
- 즉 지금도 AI 크롤러는 이 페이지를 가져가고 있고, **가져가는 것이 46자다.**

### 검색 시장 현실 (SXO)

대상 쿼리 4개(`송파 카공카페`, `잠실 노트북 하기 좋은 카페`, `콘센트 있는 카페 송파`, `강남 카공맵`)
상위 결과의 약 90%가 디렉토리 리스트 페이지(약 45%)와 커뮤니티·매거진 리스티클(약 45%)이다.
**지도 앱이 결과로 뜬 사례는 0건.**

더 중요한 제약: 이 쿼리들의 실사용 검색은 대부분 **네이버**에서 일어난다. 카공맵은 큐레이션 대상
카페의 사업자가 아니라 네이버 플레이스를 대신 최적화할 수 없고, 네이버 블로그·카페 생태계 밖이라
구조적으로 그 싸움에 못 낀다.

> ⚠️ 한계: 네이버 SERP는 이번 세션에서 직접 조회하지 않았다. 일반 지식에 기댄 서술이다.

---

## 3. VALIDATE — 반증 가능성과 솔직한 ROI

**이 감사가 스스로 인정해야 할 것.** 카공맵은 사업화가 아니라 학습이 목적인 개인 습작 MVP다
(`CLAUDE.md`). 그렇다면 "검색 순위를 올린다"는 목표 자체가 이 프로젝트에 맞지 않을 수 있다.
위 SXO 분석은 이 제품이 한국 카공 카페 검색에서 구조적으로 이기기 어렵다고 말한다. 카페를 9곳에서
90곳으로 늘리고 네이버 블로그 생태계에 들어가지 않는 한 그렇다.

**그래서 이 리포트의 권고는 두 갈래로 갈린다.**

- **A. 검색을 진짜 노린다면** — 아래 실행 계획 전체가 유효하고, 사진 권리 해결이 첫 관문이다.
- **B. 습작으로 남긴다면** — SEO 항목 대부분은 백로그로 두고, **§4의 P0 하나만** 고치면 된다.
  그것은 SEO 문제가 아니라 첫인상 문제이기 때문이다.

**각 권고의 반증 조건**은 §4 표의 마지막 열에 적었다.

---

## 4. ACT — 우선순위 실행 계획

### P0 · 모바일 첫 화면에 카페가 한 곳도 안 보인다 (SEO 아님, 그러나 최우선)

`mobile.png`(390×844)를 보면 dock 카드가 뷰포트 상단 약 28%를 덮고, 지도 중심·zoom은 데스크톱과
같다. 그 결과 마커 무리가 dock 뒤로 밀려 **실제로 보이는 마커는 왼쪽 가장자리에 반쯤 걸친 하나뿐**이다.
데스크톱(1440×900)에서는 마커 7개가 송리단길·석촌 일대에 잘 모여 보인다.

이 습작의 유일한 배포 경로는 **주소를 보내는 것**이고, 그 링크는 대개 폰에서 열린다.
첫 화면에 카페가 없으면 "지도 서비스"라는 핵심 가치가 전달되지 않는다.

- **근거(THINK)**: 가치 전달은 첫 화면에서 일어난다. 마커가 안 보이면 빈 지도다.
- **의존성**: 없음. 단독으로 고칠 수 있다.
- **반증 조건**: 모바일 첫 화면 스크린샷에 마커가 3개 이상 보이면 해결이다.
- **선행 지표**: 링크를 받은 사람이 마커를 누르기까지 걸리는 시간.
- **주의**: `DESIGN.md`의 Map Shell 규칙(지도는 `100dvh`, UI는 그 위에 뜬다)을 건드리는 변경이라면
  코드보다 문서를 먼저 고쳐야 한다.

### P1 · 서버 렌더 텍스트 만들기 (①의 해법)

`app/page.tsx`는 이미 서버 컴포넌트에서 `getCafes()`로 데이터를 들고 있다(`revalidate = 300`).
그것을 client props로만 넘기지 말고, 지도 아래에 **SSR로 렌더되는 카페 목록 블록**으로도 뽑는다 —
카페별 `h2`/`h3` + 주소 + 콘센트·와이파이·소음 + 확인일.

- **근거(THINK)**: 검색엔진과 LLM은 텍스트를 읽는다. 지도는 텍스트가 아니다.
- **의존성**: P2(schema)와 P4(work_policy 텍스트 노출)를 **동시에 푼다.** 이것이 먼저다.
- **스코프 확인**: 이것은 2차로 미뤄둔 "동작하는 검색 UI"와 다른 문제다. `scope.md` 원칙을 어기지 않는다.
- **반증 조건**: `curl`로 받은 raw HTML에서 카페 9곳 이름이 `<script>` 밖에 나오면 해결이다.
  (지금은 46자, 목표는 9곳 × 이름+주소+속성.)
- **선행 지표**: raw HTML의 body 텍스트 길이.

### P2 · JSON-LD 추가 (`WebSite` + `ItemList`)

seo-schema가 `types/cafe.ts` 필드에 정확히 대응시킨 마크업과 `lib/schema.ts` 구현 스니펫을 만들어
뒀다 (`seo-schema.md` §3-3, 9곳 전체를 채운 예시는 `itemlist.json`).

판단 근거:
- `CafeOrCoffeeShop`을 소유하지 않은 카페에 쓰는 것은 디렉터리 사이트의 정상 관행이다. 이름·주소·
  영업시간·와이파이는 화면에 실제로 보이는 내용이므로 misrepresentation 리스크가 낮다.
- 다만 **리치 리절트로 이어지지 않는다.** `LocalBusiness`류는 자체 SERP 배지가 없고, Knowledge
  Panel은 그 사업체가 GBP로 직접 관리하는 페이지에만 붙는다. 얻는 것은 entity 이해도와 AI 크롤러
  파싱 편의뿐이고, 후자의 실효성은 확인된 바 없다.
- **`AggregateRating`은 넣지 않는다.** `ReviewSection.tsx`의 집계는 마운트 후 `useEffect`로 가져오는
  client-only 값이라 SSR HTML에 없고, good/bad 두 값이라 `ratingValue` 스케일과도 안 맞는다.
- `iced_americano_price`는 `priceRange` 오용이라 제외. `outlet`/`noise`/`wifi`/`work_fit`/
  `last_verified`는 도메인이 안 맞는 `amenityFeature` 대신 `additionalProperty`로 넣는다.
- `item.url`은 자체 URL이 없으므로 `naver_place_url`(nullable, 없으면 필드 생략)을 쓴다.

- **의존성**: P1이 없으면 "페이지에 없는 내용을 마크업"하는 것이 된다. **P1 뒤에 온다.**
- **반증 조건**: Rich Results Test가 `ItemList` 9개 항목을 오류 없이 파싱하면 해결이다.

### P3 · 보안 헤더 4개 추가

현재 `strict-transport-security` 하나뿐이다. `next.config.ts`에 `headers()`도, `vercel.json`도 없다.
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`가 빠져 있다.

- SEO 직접 효과는 미미하지만 비용이 거의 0이고, 로그인·리뷰·제보를 받는 서비스에 없을 이유가 없다.
- **반증 조건**: `curl -I`에 네 헤더가 나오면 해결이다.

### P4 · `work_policy` 결정 (열려 있던 문제에 대한 답)

SXO의 판정은 **조건부 예**다.

- SERP에 "눈치 안 보임"류 표현이 실제로 반복 등장한다. `scope.md`의 "가장 차별적" 주장은 검증된다.
- 그러나 **필터 UI로만 만들면 SEO 효과는 거의 0이다.** 클라이언트 상호작용은 검색엔진이 읽지 못한다.
- 카페별로 **항상 보이는 텍스트 + 스키마**로 노출해야 순위 기회가 생긴다. 지금 SERP 어디도 이걸
  구조화된 값으로 보여주지 않는다.

- **권고**: 필터 UI는 계속 미뤄도 된다. 하지만 **enum 데이터 모델과 텍스트 렌더링은 지금 정하고 지금 채운다.**
  이것은 P1과 같은 작업에 얹으면 되는 일이다.
- **반증 조건**: `work_policy`를 채운 뒤에도 대상 쿼리에서 노출이 없으면 이 가설이 틀린 것이다.

### P5 · `last_verified`를 진짜 날짜로

`last_verified` 노출은 QRG가 강조하는 신선도 투명성을 정확히 구현한 강점이다. 그런데 현재 9곳 전부
동일한 임시 날짜다(`CLAUDE.md`에 이미 기록됨). noindex 해제 전에 실제 방문 확인 날짜로 갱신하지 않으면
**"확인일"이 오히려 가짜 신선도 신호로 읽힌다** — 강점이 약점으로 뒤집히는 항목이다.

### 하지 않을 것

| 항목 | 이유 |
|---|---|
| **sitemap.xml 추가** | 지금은 무의미가 아니라 **역효과**다. URL이 하나뿐이라 robots.txt가 이미 하는 일을 반복할 뿐이고, `/`가 noindex라 sitemap에 올리는 순간 Search Console에 "Submitted URL marked noindex" 경고를 스스로 만든다. `app/robots.ts`의 현재 판단이 정확하다. 카페별 라우트가 생기면 그때 다시 본다 |
| **llms.txt 추가** | 404 확인. 주요 AI 플랫폼이 grounding에 실제로 쓴다는 근거가 약하다. 콘텐츠가 생기기 전에는 우선순위가 아니다 |
| **`robots.txt`에 `Disallow: /`** | 링크 펼치기 봇이 OG 카드를 못 가져간다. 현재 설계가 의도적으로 옳다 |
| **백링크·브랜드 엔티티 작업** | Wikipedia·Reddit·YouTube·백링크 전부 없는 것이 1인 습작 MVP의 자연스러운 상태다. 구조 개선 뒤 따라올 항목 |
| **카페 수 늘리기** | 9곳이라는 개수는 문제가 아니다. 카페 1곳당 콘텐츠 밀도가 먼저다 |
| **카카오맵 타일 최적화** | LCP 요소지만 카카오 서버 리소스라 조치 불가 |

---

## 5. 성능 상세 (lab only)

| 지표 | 값 | 판정 |
|---|---|---|
| Performance score | 70/100 | — |
| **LCP** | 7327ms (simulated) / 1127ms (observed) | Poor / Good |
| LCP 요소 | **카카오맵 raster tile PNG** (`mts.daumcdn.net/.../PNG02/.../233.png`) | — |
| LCP subpart | TTFB 89.6ms · resource load delay 374.5ms · load duration 115.4ms · render delay 547.9ms | — |
| **CLS** | **0** | Good |
| **INP** | **측정 실패** | 미확정 |
| TBT | 26ms | 매우 낮음 |
| 총 리소스 | 46 requests, 1.32MB | — |

- LCP 간극은 뷰포트를 채우는 지도 타일 12장(약 715KB)이 순차 로드되는 데서 온다. 타일 URL은 SDK가
  JS로 계산해 만들기 때문에 **preload가 원천적으로 불가능**하다.
- CLS가 0인 것은 `CafeMarker.tsx`가 마커 DOM을 한 번만 만들고 `CustomOverlay`(absolute positioning)라
  document flow를 건드리지 않기 때문이다. 설계가 맞았다.
- INP는 일반 페이지 로드 trace에 interaction이 없어 산출되지 않았다. TBT 26ms와 `handleSelect`가
  `panTo` 없이 state만 갱신하는 구조로 볼 때 Good일 가능성이 높지만 **확정치가 아니다.**
- Supabase 카페 사진은 `next/image`를 정상 통과한다(`/_next/image?...&w=96&q=75`, `loading="lazy"`,
  결과물 1.1~3.3KB). 이미 잘 최적화돼 있다.
- 개선 여지: `dapi.kakao.com`·`t1.daumcdn.net`·`mts.daumcdn.net`에 `preconnect` 추가.

---

## 6. 잘 되어 있는 것

깎을 것만 적으면 리포트가 거짓말이 된다.

- **메타데이터 레이어가 탄탄하다.** title·description·OG·Twitter Card·canonical·`lang="ko"` 전부 정상.
  문제는 전부 본문 콘텐츠 레이어에 몰려 있다.
- **og:image가 프로덕션에서 정상이다.** 1200×630, 한글 렌더 정상, 줄바꿈도 의도한 자리에서 끊긴다.
  satori woff 처리가 실제로 먹혔다.
- **지도가 프로덕션에서 뜬다.** vercel.app 도메인이 카카오 콘솔에 등록돼 있다.
- **CLS 0.** 마커 오버레이 설계의 직접적인 결과다.
- **`next/image` 경로가 정상**이고 이미지가 이미 최적화돼 있다.
- **콘솔 에러 0건** (경고 1건: Supabase GoTrueClient 중복 인스턴스, 화면 영향 없음).
- **`last_verified` 노출 결정**은 QRG 신선도 투명성 원칙과 정확히 맞는다. 값만 채우면 된다.
- **`app/robots.ts`의 현재 판단이 옳다.** sitemap을 두지 않은 것도, 전부 허용한 것도.

---

## 7. 세부 리포트

| 파일 | 내용 |
|---|---|
| `seo-technical.md` | 9개 카테고리, 보안 헤더, JS 렌더링, canonical 표기 |
| `seo-content.md` | E-E-A-T 4축 점수, 신뢰 지면 부재 |
| `seo-schema.md` | 타입 판단 근거, `lib/schema.ts` 구현 스니펫 |
| `itemlist.json` | 카페 9곳 전체를 채운 검증용 JSON-LD |
| `seo-sitemap.md` | 세 시나리오별 `app/sitemap.ts` / `app/robots.ts` 코드 |
| `seo-performance.md` | Lighthouse 13.4.1 lab 상세 |
| `seo-visual.md` | 데스크톱·모바일 스크린샷 분석, tap target 측정 |
| `seo-geo.md` | AI 크롤러별 판정, citability, llms.txt 근거 |
| `seo-sxo.md` | SERP 역분석, 유저 스토리 5개, 페르소나 5개, `work_policy` 판단 |
| `desktop.png` · `mobile.png` | 감사 시점 스크린샷 (1440×900 / 390×844). P0 근거 |

---

## 8. 이 감사의 한계

- **Performance는 lab data 1회 실행뿐이다.** field data는 트래픽이 없어 존재하지 않는다.
- **INP는 측정하지 못했다.** 실제 마커 클릭 interaction trace가 필요하다.
- **네이버 SERP를 직접 조회하지 않았다.** SXO의 한국 검색 시장 서술은 일반 지식에 기댄 것이다.
  이 프로젝트에서 가장 중요한 검색 채널일 수 있으므로 가장 큰 제약이다.
- **On-Page·Images 점수는 오케스트레이터 추정치**다. 전담 에이전트를 돌리지 않았다.
- **로그인 이후 화면은 확인하지 않았다.** 카카오 계정 입력은 사람이 하는 일이다.
