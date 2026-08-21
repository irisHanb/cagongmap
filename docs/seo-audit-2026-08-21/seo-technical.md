# Technical SEO Audit — https://cagongmap-nu.vercel.app/

감사 일시: 2026-08-21. 단일 라우트(`/`)만 대상이며, `noindex, nofollow`는 의도된 상태(사진 9장 저작권 미확인)로 간주해 "지금 문제"가 아니라 "noindex 해제 시 대비" 관점으로 평가함.

## 요약 스코어: 58/100

콘텐츠(카페 9곳 정보)가 크롤러가 읽는 텍스트로 전혀 노출되지 않는 구조적 문제(Critical)가 점수를 크게 깎았어요. 메타데이터·OG·robots.txt·HTTPS 기본기는 탄탄합니다.

---

## 카테고리별 Pass/Fail

| 카테고리 | 상태 | 비고 |
|---|---|---|
| 1. Crawlability | PASS (조건부) | robots.txt 전체 허용, 의도된 noindex는 meta에만 |
| 2. Indexability | FAIL | canonical/meta는 정상이나 핵심 콘텐츠가 색인 불가 구조 |
| 3. Security | FAIL | HSTS 외 보안 헤더 전무 |
| 4. URL 구조 | PASS | 단일 라우트, 리다이렉트 깔끔 |
| 5. Mobile | PASS (경미한 지적) | viewport 정상, 마커 터치 타깃 46px |
| 6. Core Web Vitals | NEEDS IMPROVEMENT | JS 페이로드 크고 렌더 안정화 9초+ |
| 7. Structured Data | FAIL | JSON-LD 전무 |
| 8. JS Rendering | FAIL (구조적) | CSR 전용, 핵심 콘텐츠가 텍스트 노드가 아님 |
| 9. IndexNow | N/A (해당 없음) | noindex 상태에서 무의미, 페이지도 1개뿐 |

---

## Critical

### C1. 카페 9곳의 핵심 정보가 크롤러가 읽는 "텍스트"로 전혀 존재하지 않음

`render_page.py --mode auto`로 raw HTML과 Playwright 렌더 DOM을 둘 다 확인했는데, 두 경우 모두 `extracted_text`가 동일했어요.

```
250m
WORK CAFE MAP
카공맵
오래 앉아 작업하기 좋은 카페 9곳
카카오 로그인
카페 제보하기
```

카페 이름·주소·태그·영업시간 같은 실제 콘텐츠는 여기 없습니다. 원인을 소스에서 확인했어요.

- `components/map/MapView.tsx`가 카페 배열을 `KakaoMap` 자식으로 넘기고, 실제 렌더는 `components/map/CafeMarker.tsx`가 담당합니다.
- `CafeMarker.tsx`를 보면 카페 이름은 `<button title="{cafe.name} · {workFit}" aria-label="{cafe.name}, {workFit} — 상세 보기">` 형태로만 존재해요. 안의 `<Image alt="" .../>`는 `alt`를 의도적으로 비웠고(부모 `aria-label`과 중복 방지), **가시 텍스트 노드는 어디에도 없습니다.**
- 이 버튼 자체도 Kakao Maps SDK(`dapi.kakao.com`)가 로드되고 `kakao.maps.load()` 콜백 안에서 지도 인스턴스가 만들어지고, `CustomOverlay`가 생성되고, 그 DOM에 `createPortal`로 React가 그려지는 다단계 체인이 끝나야 나타납니다. 상세 정보(주소·태그·영업시간 등)는 그 마커를 "클릭"해야 뜨는 `CafeCard` 패널에만 있고요.
- 실제로 raw HTML을 열어보면 카페 데이터 자체는 `self.__next_f.push(...)` 안의 RSC flight payload(JSON)로 **바이트 상으로는 존재**합니다(이름·주소·좌표·태그·`naver_place_url`·사진 URL까지 전부). 하지만 이건 `<script>` 안의 직렬화 데이터이지 시맨틱 HTML이 아니에요 — Google이 일반 텍스트 콘텐츠로 추출하는 대상이 아닙니다(schema.org JSON-LD가 아닌 임의 JSON은 콘텐츠로 인정 안 됨).

**영향**: noindex를 해제하는 날에도 Google이 색인할 텍스트가 "카공맵, 카페 9곳, 카페 제보하기"뿐이에요. 카페 이름·지역명("송파", "잠실", "강남")·"콘센트", "와이파이" 같은 검색 의도 키워드가 페이지 텍스트에 단 하나도 없습니다. 지금 이 사이트가 노리는 검색어("송파 카공하기 좋은 카페" 등)로는 절대 걸리지 않는 구조예요.

**권장 조치** (noindex 해제 전 처리 권장):
1. 지도 아래/뒤에 **SSR되는 텍스트 리스트**(예: `<ul>`로 9개 카페명·주소·태그, `visually-hidden` 처리해도 무방)를 추가한다. 지도는 그대로 두고 크롤러용 텍스트만 별도 레이어로 둔다.
2. 최소한 `LocalBusiness`/`ItemList` JSON-LD(아래 C2)로라도 구조화 데이터를 제공한다.
3. 마커 버튼의 `title`/`aria-label`은 접근성엔 좋지만 SEO 텍스트 콘텐츠로 취급되지 않는다는 점을 인지하고 있어야 한다.

---

## High

### H1. 보안 헤더가 HSTS 하나뿐

`curl -I` 및 404 페이지 모두 확인 — 존재하는 헤더:

```
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-powered-by: Next.js
```

**없는 헤더**: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`(또는 CSP `frame-ancestors`), `Referrer-Policy`, `Permissions-Policy`. `next.config.ts`에 `headers()` 설정이 없고, 저장소 루트에 `vercel.json`도 없어서(확인함) Vercel 기본값 외에는 아무것도 안 붙습니다.

Lighthouse Best Practices 점수에 직접 반영되고, `X-Content-Type-Options: nosniff` 부재는 MIME 스니핑 공격 표면을 남겨요. 카카오 로그인(OAuth)과 Supabase 세션 쿠키를 다루는 사이트라 최소한의 헤더는 있는 게 맞습니다.

**권장**: `next.config.ts`에 `headers()` 추가.
```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ],
  }];
}
```
CSP는 Kakao Maps(`dapi.kakao.com`, `*.daumcdn.net` 타일), Supabase Storage, Vercel 자체 스크립트를 모두 허용해야 해서 설계가 필요해요 — 잘못 걸면 지도가 깨지므로 별도 작업으로 분리 권장.

### H2. JSON-LD 구조화 데이터 전무

`render_page.py`의 `structured_data.block_count`가 `0`이에요. `LocalBusiness`(9곳 각각) 또는 `ItemList` + `LocalBusiness` 조합으로 이름·주소·좌표·영업시간을 마크업하면, C1의 텍스트 부재 문제를 부분적으로 보완하고 리치 결과(지도팩 등) 후보가 될 수 있어요. 데이터는 이미 `lib/cafes.ts`가 서버에서 들고 있으니 `app/page.tsx`(서버 컴포넌트)에서 `<script type="application/ld+json">`로 내려주는 건 어렵지 않습니다.

---

## Medium

### M1. `Content-Encoding`이 CSS/JS 정적 자산에서 확인 안 됨 / JS 페이로드가 큼

주요 청크 합산(비압축 `content-length` 기준, `curl -I`):

```
0tfkf-xs8lrxj.js      233,596 B
1xel9ve3f1evk.js      300,613 B
1dlgnufdzv8ey.js      159,706 B
0c0hxoamwjsbw.js      112,594 B
... 등 총 12개 청크 ≈ 878 KB
```

여기에 Kakao Maps SDK 자체(외부 `dapi.kakao.com` 스크립트, 별도 도메인이라 트래킹 안 됨)와 지도 타일 요청이 추가로 붙어요. `Script strategy="afterInteractive"`로 렌더 블로킹은 피했지만(`components/map/KakaoMap.tsx`), 총 JS 실행 비용이 상당해서 저사양 모바일에서 **INP**가 취약할 수 있어요.

Playwright 렌더 시 `render_diagnostics`가 `"DOM did not reach the bounded stability threshold"`를 보고했고, `render_ms`가 **9,030ms**였어요. 지도 타일·9개 마커 이미지·React 하이드레이션이 겹치며 DOM이 계속 변하는 구간이 길다는 신호입니다. 실제 필드 데이터(CrUX)는 별도 확인이 필요하지만, 소스만 봐도 LCP/INP 여유가 크지 않아 보여요.

**권장**: 카페 마커 이미지 9장 모두 `next/image`로 최적화되고 있는 건 확인했어요(`sizes="48px"`, `width/height=96`) — 이 부분은 잘 되어 있습니다. 남은 개선 여지는 청크 분할(불필요한 하위 컴포넌트 lazy load) 정도예요.

### M2. 마커 터치 타깃이 권장 최소치에 살짝 못 미침

`app/globals.css`의 `.cafe-marker`가 `width: 46px; height: 46px`(+ `border: 2px`)예요. Google/WCAG 권장 최소 터치 타깃은 48×48px(WCAG 2.2 AA는 24px, Apple HIG는 44px)이라 46px은 애매한 경계값입니다. 지도 마커 특성상 밀집 배치가 필요해 트레이드오프가 있다는 건 이해하지만, 48px로 올리는 걸 고려할 만해요. Low에 가까운 Medium.

### M3. canonical URL과 실제 서빙 URL의 trailing slash 불일치 (영향 미미하지만 기록)

`alternates: { canonical: "/" }`(`app/layout.tsx`)가 `metadataBase`(`https://cagongmap-nu.vercel.app`, trailing slash 없음)와 결합되면서 렌더된 `<link rel="canonical">`이 `https://cagongmap-nu.vercel.app`(슬래시 없음)로 나가요. `og:url`도 동일합니다. 실제 서버는 `/`가 있든 없든 200으로 응답하고 리다이렉트하지 않으므로(`curl` 확인: 둘 다 200, 리다이렉트 체인 없음) 중복 URL로 나뉠 위험은 낮지만, canonical 태그 값 자체가 URL 정규 표기(trailing slash 포함)와 미묘하게 다른 상태예요. `SITE_URL`을 `'https://cagongmap-nu.vercel.app/'`(슬래시 포함)로 맞추면 해소됩니다. 지금은 Low~Medium.

---

## Low / 정보성

### L1. Crawlability 기본기는 정상
- `robots.txt`: `User-Agent: * / Allow: /` + `Host: https://cagongmap-nu.vercel.app` — 전체 허용 확인. `Host` 지시자는 표준이 아니지만(Yandex 확장) 해로울 것 없음.
- Sitemap: `sitemap_discovery.py` 결과 `declared: []`, `found: []` — sitemap 없음. **의도된 상태**(단일 페이지, 그마저 noindex라 `app/robots.ts` 주석에 명시)로 지금은 문제가 아님. 여러 카페 상세 URL이 생기는 시점(현재는 없음 — "카페별 URL 없음"이 CONTEXT로 확정됨)에는 sitemap 도입을 재검토.
- `noindex, nofollow`는 `robots.txt`가 아니라 `<meta name="robots">`에만 있음 — 슬랙 등 링크 언퍼를 봇을 위해 의도적으로 설계된 대로 정확히 구현되어 있음(`app/robots.ts`의 주석과 일치, 실제로도 `robots.txt`는 전체 허용).

### L2. HTTPS / 리다이렉트 정상
- `http://` → `https://`: 308 Permanent Redirect, 체인 1홉으로 깔끔 (`Location: https://cagongmap-nu.vercel.app/`).
- HSTS: `max-age=63072000; includeSubDomains; preload` — preload 리스트 등재 요건 충족.
- 대소문자: `/INDEX` → 404 정상.
- `www.` 서브도메인은 연결 자체가 안 됨(`.vercel.app` 프리뷰 도메인 특성상 해당 없음, 커스텀 도메인 붙일 때 재검토 필요).

### L3. 메타데이터/OG는 모범적으로 잘 되어 있음
- `title`, `description`, `og:*`(title/description/url/site_name/locale/image 4종/type), `twitter:*` 전부 존재하고 값이 정확히 일치함.
- `og:image`는 `app/opengraph-image.tsx` 파일 컨벤션으로 자동 생성, `1200x630`, `image/png`, 실제 요청 시 200 확인.
- `apple-icon`, `favicon.ico`, `icon.svg` 모두 200 확인.
- `lang="ko"` html 속성과 실제 한국어 콘텐츠 일치.
- `viewport: width=device-width, initial-scale=1` — 확대/축소 제한 없음(접근성 양호).

### L4. Naver/Bing/Yandex 사이트 인증 메타 태그 없음
`google-site-verification`, `naver-site-verification`, `msvalidate.01`, `yandex-verification` 전부 미확인. 한국 서비스라 Naver 웹마스터도구 등록이 특히 의미 있는데, noindex 상태라 지금 등록해도 효과가 없어요. **noindex 해제 시점에 함께 처리할 항목으로 기록.**

### L5. IndexNow — 해당 없음
`/.well-known` 경로에 IndexNow 키 파일 없음(404 확인), 코드베이스에도 관련 파일 없음. 현재 단일 페이지 + noindex 상태에서는 무의미. C1(콘텐츠 색인 구조)과 H2(구조화 데이터)를 먼저 해결하는 게 우선순위가 높고, IndexNow는 향후 카페 상세 URL이 여러 개 생기고 업데이트가 빈번해질 때 검토.

---

## 우선순위 정리

1. **Critical** — C1: 카페 콘텐츠를 크롤러가 읽는 텍스트/구조화 데이터로 노출 (noindex 해제 전 필수)
2. **High** — H1: 보안 헤더 추가 (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`), H2: JSON-LD `LocalBusiness`/`ItemList` 도입
3. **Medium** — M1: JS 페이로드/렌더 안정화 시간 점검, M2: 마커 터치 타깃 46→48px, M3: canonical trailing slash 통일
4. **Low** — L4: Naver 등 사이트 인증 태그(noindex 해제 시), L5: IndexNow(다중 URL 생길 때)
