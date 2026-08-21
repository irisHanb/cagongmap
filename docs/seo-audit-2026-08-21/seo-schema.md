# Schema.org 분석 — https://cagongmap-nu.vercel.app/

## 0. 현재 상태

- JSON-LD 0개 (orchestrator 확인대로, 재확인 안 함).
- `robots: { index: false, follow: false }`가 `app/layout.tsx`에 명시돼 있음 — 사진 9장 저작권
  미확인 때문(의도된 결정, `mvp-decisions.md`). **noindex인 동안은 아래 어떤 JSON-LD를 넣어도
  Google 리치 리절트로 이어지지 않는다.** 지금 하는 작업은 (a) noindex를 풀 날을 위한 준비,
  (b) AI 크롤러(LLM 답변 엔진)를 위한 준비 두 가지 목적이고, (b)의 실효성은 확인된 바 없다.
- 라우트는 `/` 하나. 카페 상세는 클라이언트 패널(지도 위 오버레이)이라 URL이 없다 — 이 제약이
  아래 모든 판단의 기준이다.

---

## 1. 어떤 스키마가 실제로 맞는가

### 1-1. `LocalBusiness` / `CafeOrCoffeeShop`을 카페마다 직접 마크업해도 되는가

**된다.** 이건 소유권 주장이 아니다. Yelp·다이닝코드·망고플레이트 같은 디렉터리 사이트가
자신이 운영하지 않는 매장을 `LocalBusiness`/`Restaurant`로 마크업하는 것은 일반적인 관행이고,
Google 구조화 데이터 정책이 막는 것은 "페이지에 실제로 없는 내용을 마크업하는 것"이지
"제3자 사업체의 공개 정보를 서술하는 것"이 아니다. 이름·주소·영업시간·와이파이·콘센트 여부는
전부 화면에 실제로 보이는 내용이므로 **misrepresentation 리스크는 낮다.**

다만 두 가지는 분명히 짚어야 한다.

1. **리치 리절트로 이어지지 않는다.** `LocalBusiness`류는 Product/Recipe/Event처럼 자체 SERP
   배지가 없다. Knowledge Panel에 붙으려면 그 사업체가 Google Business Profile을 통해 직접
   관리·인증한 페이지여야 하는데, 카공맵은 그 사업체와 아무 관계가 없다. 즉 이 마크업의 효과는
   "카페 각각의 검색 노출"이 아니라 **카공맵 페이지 자체의 entity 이해도**(그리고 AI 크롤러의
   파싱 편의성)에 그친다.
2. **`AggregateRating`/`Review`는 넣지 않는다.** 이유가 둘이다. 첫째, `place_reviews`의 집계
   (`ReviewSection.tsx`)는 마운트 후 `useEffect`로 클라이언트에서 가져오는 값이라 페이지에
   확정적으로 존재하는 콘텐츠가 아니다 — SSR된 HTML에 없는 값을 JSON-LD로 박으면 구조화 데이터가
   "페이지 콘텐츠를 반영해야 한다"는 원칙에 어긋난다. 둘째, 값 자체가 good/bad 두 값
   (`REVIEW_VALUES`)이라 `ratingValue`가 요구하는 숫자 스케일과 형태가 안 맞는다. 억지로
   1/5, 5/5로 치환하는 건 데이터 왜곡이다.

### 1-2. `ItemList`

카페 9곳을 감싸는 리스트 컨테이너로 적합하다. **단, 카드/캐러셀형 리치 리절트는 기대하지 않는다.**
Google의 ItemList 캐러셀 가이드는 각 `ListItem`이 **1차 도메인의 상세 페이지**를 가리킬 것을
전제로 하는데(2-1절 참고), 카공맵은 그 URL이 없다. 지금 넣는 `ItemList`는 순수하게
entity 그룹화 정보이지, SERP 카드를 노리는 마크업이 아니다.

### 1-3. `Dataset`

기술적으로는 가능하다("장소별 콘센트/와이파이/소음 정보를 모은 표"라는 프레이밍이 데이터셋이라는
설명 자체는 사실이다). 하지만 Google의 Dataset 리치 리절트는 연구·정부·기상 데이터처럼 **명시적으로
데이터를 내려받거나 탐색하는 것이 페이지의 목적일 때**를 겨냥한다. 카공맵의 목적은 "카페를
찾아서 방문한다"이지 "데이터셋을 탐색한다"가 아니라서, `Dataset`을 주 타입으로 쓰면 페이지의
실제 목적과 어긋나는 프레이밍이 된다. **추천하지 않는다.** (병행은 가능하지만 지금 얻는 것에
비해 관리 부담만 늘어난다.)

### 1-4. 결론

| 타입 | 채택 | 이유 |
|---|---|---|
| `WebSite` | 채택 | 사이트 정체성 최소 표현. 리스크 없음 |
| `Organization` | **보류** | 아래 1-5 참고 |
| `ItemList` + `CafeOrCoffeeShop` | 채택 | 디렉터리의 정상적인 관행. SERP 효과는 없되 entity/AI 이해도에 기여 |
| `AggregateRating`/`Review` | 제외 | 페이지에 SSR로 존재하지 않는 값, 스케일도 안 맞음 |
| `Dataset` | 제외 | 페이지 목적과 프레이밍이 어긋남 |
| `FAQPage`/`HowTo` | 제외 (지시대로) | 리치 리절트 없음/폐기 |

### 1-5. `Organization`은 왜 보류하나

`WebSite.publisher`로 `Organization`을 넣고 싶어질 수 있는데, 지금은 넣지 않는 걸 권한다.
카공맵은 "개인 습작 MVP"(`CLAUDE.md`)이고, 사업자·팀·About 페이지가 없다. 실체가 없는
`Organization`(placeholder 주소, 없는 로고 URL 등)을 억지로 채우면 오히려 "필수/권장 속성만
채웠지 실체가 비어 있는" 상태가 되고, 이건 검증 체크리스트 5번("플레이스홀더 텍스트 금지")에
바로 걸린다. 대신 `WebSite`만 단독으로 두거나, 굳이 필요하면 `Person`(개인 제작자)을
`creator`로 다는 정도가 정직하다. 아래 생성물은 `Organization` 없이 `WebSite` 단독으로 갔다.

---

## 2. 하드 제약 — 카페에 자체 URL이 없다

이게 이 작업 전체를 규정하는 제약이라 명확히 정리한다.

### 지금 할 수 있는 것

- `ItemList.itemListElement[].item`에 카페 정보를 **인라인 객체**로 담는다 (별도 `@id`/`url`
  없이도 유효한 JSON-LD다).
- `item.url`에는 **카공맵 자체 URL이 아니라 `naver_place_url`**을 넣었다. 이건 그 사업체의
  실제 웹 프레즌스를 가리키는 정직한 링크이고("이 정보를 어디서 더 확인할 수 있는가"), 소유권을
  주장하는 것도 아니다. `naver_place_url`이 `null`인 카페(설계상 nullable, `types/cafe.ts`
  12번 줄)는 `url` 필드 자체를 생략했다 — 빈 문자열이나 카공맵 홈 URL로 채우는 건 거짓 정보다.

### 지금 할 수 없는 것 (그리고 왜 중요한가)

- **ItemList 캐러셀 리치 리절트.** Google 문서상 이 기능은 각 아이템이 사이트 자신의 상세
  페이지를 가리킬 때만 적용 대상이 된다. 카공맵은 후보에 못 든다 — noindex를 풀어도 마찬가지다.
- **카페별 Knowledge Panel 기여.** 위 1-1절과 같은 이유.
- **카페별 canonical entity `@id`.** 지금은 각 `item`이 익명 객체다. 카페 하나를 두 번 이상
  참조할 방법(예: 지도 마커 스키마와 리스트 스키마가 같은 엔티티를 가리킨다는 것)을 표현할
  '고리'가 없다.

### 카페별 라우트(`/cafe/[slug]`)가 생기면 바뀌는 것

1. `item.url`을 `naver_place_url`에서 **카공맵 자체 URL**(`https://cagongmap-nu.vercel.app/cafe/naruteo`)로
   교체한다 — 이게 되는 순간 외부(네이버맵)로 새던 권위가 카공맵으로 돌아온다.
2. 각 상세 페이지에 그 카페 하나만의 `CafeOrCoffeeShop` JSON-LD를 얹을 수 있다. 이러면
   `BreadcrumbList`도 자연스럽게 붙고, `@id`로 지도 마커·리스트·상세 세 곳이 같은 엔티티를
   가리키게 통일할 수 있다.
3. **ItemList 캐러셀 리치 리절트 후보**가 된다(자격이지 보장은 아니다).
4. 리뷰 집계(`place_review_counts`)를 상세 페이지에서 SSR로 먼저 그린다면(지금은 client-only
   `useEffect`) 그때 `AggregateRating` 재검토가 가능해진다 — 지금은 안 된다는 1-1절 판단이 바뀐다.

**요약: 없는 건 못 만든다.** 지금 나오는 JSON-LD는 "카공맵 홈페이지 하나가 카페 9곳을 다루고
있다"는 사실을 정직하게 서술하는 선에서 최대치다. "카페마다 독립된 웹 페이지가 있다"는 인상을
주는 마크업(캐러셀 지향 구조, canonical `@id` 남발)은 넣지 않았다.

---

## 3. 생성한 JSON-LD

### 3-1. `WebSite` (홈페이지 전체)

`app/layout.tsx`의 `SITE_URL`/`SITE_NAME`/`SITE_DESCRIPTION`(`lib/site.ts`)과 동일한 값을 썼다.
검색바가 아직 동작하지 않으므로(`CLAUDE.md` — "동작하지 않는 검색바를 먼저 띄우지 않는다")
`potentialAction.SearchAction`은 넣지 않았다. 검색이 실제로 붙으면 그때 추가한다.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "카공맵",
  "url": "https://cagongmap-nu.vercel.app",
  "description": "콘센트·와이파이·소음으로 작업하기 좋은 카페를 지도에서 찾습니다.",
  "inLanguage": "ko-KR"
}
```

### 3-2. `ItemList` (카페 9곳)

`types/cafe.ts`의 `Cafe` 필드에 직접 대응시켰다. 필드 매핑:

| `Cafe` 필드 | JSON-LD 대응 |
|---|---|
| `name` | `item.name` |
| `address` | `item.address.streetAddress` (문자열 그대로 — 시/구/동을 쪼개 파싱하지 않았다. 원본 주소 문자열이 이미 도로명 표기라 임의로 쪼개면 `addressLocality` 오기재 위험이 더 크다) |
| `lat`/`lng` | `item.geo` |
| `naver_place_url` | `item.url` — **`null`이면 필드 자체를 생략** |
| `open_time`/`close_time` | `openingHoursSpecification[].opens/closes` — `closes`가 `opens`보다 이르면(예: `08:00`→`02:00`, `12:00`→`00:00`) 자정을 넘긴 영업으로, schema.org 시간 표현이 그대로 허용한다(Google 레스토랑 예시에도 있는 패턴). 요일별 시간 차이가 데이터에 없어 7일 전부 동일하게 넣었다 |
| `is_24h` | 현재 시드 9곳 전부 `false`라 이 필드를 쓰는 카페가 없다. `true`인 카페가 생기면 `opens: "00:00", closes: "23:59"`로 처리하는 분기를 추가해야 한다 |
| `wifi`/`outlet`/`noise`/`work_fit` | `additionalProperty`의 `PropertyValue` — `amenityFeature`는 schema.org 정의상 `LodgingBusiness`/`Accommodation` 도메인이라 `CafeOrCoffeeShop`에 쓰면 타입 밖 사용이 된다. `additionalProperty`는 `Thing` 전체에 열려 있어 안전하다 |
| `last_verified` | `additionalProperty`의 `lastVerified` — "데이터 신선도를 숨기지 않는다"는 프로젝트 원칙(`mvp-decisions.md`)을 스키마에도 반영했다 |
| `iced_americano_price` | **넣지 않았다.** `priceRange`는 "$$"류 등급 표현이지 특정 메뉴 가격이 아니다. 아메리카노 가격 하나로 `priceRange`를 채우는 건 속성 오용이다. 진짜 넣으려면 `hasMenuItem`/`Offer` 구조가 따로 필요한데, 지금 화면에 메뉴판이 없으므로 보류한다 |
| `photos` | **정적 예시에는 없음.** 실제 구현에서는 `cafe.photos`(런타임에 `toCafe()`가 만드는 공개 URL 배열)를 `item.image`로 넣는다. 아래 3-3절 스니펫 참고 |
| `tags` | 넣지 않았다. 자유 태그를 그대로 구조화 속성에 태우면 스팸성 키워드 나열로 읽힐 수 있어 보류했다 |

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "카공맵 — 노트북 작업하기 좋은 카페",
  "description": "콘센트·와이파이·소음 등 노트북 작업 조건을 기준으로 큐레이션한 서울 송파·잠실·강남 카페 목록",
  "itemListOrder": "https://schema.org/ItemListUnordered",
  "numberOfItems": 9,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "CafeOrCoffeeShop",
        "name": "나루터",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "서울 송파구 백제고분로41길 19-1 2층",
          "addressCountry": "KR"
        },
        "geo": { "@type": "GeoCoordinates", "latitude": 37.5077632, "longitude": 127.1072485 },
        "url": "https://map.naver.com/p/entry/place/1747832649",
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
              "https://schema.org/Monday", "https://schema.org/Tuesday", "https://schema.org/Wednesday",
              "https://schema.org/Thursday", "https://schema.org/Friday", "https://schema.org/Saturday",
              "https://schema.org/Sunday"
            ],
            "opens": "12:00",
            "closes": "00:00"
          }
        ],
        "additionalProperty": [
          { "@type": "PropertyValue", "name": "wifi", "value": true },
          { "@type": "PropertyValue", "name": "outletLevel", "value": "many" },
          { "@type": "PropertyValue", "name": "noiseLevel", "value": "quiet" },
          { "@type": "PropertyValue", "name": "workFit", "value": "good" },
          { "@type": "PropertyValue", "name": "lastVerified", "value": "2026-08-12" }
        ]
      }
    }
  ]
}
```

나머지 8곳까지 채운 전체 JSON(9개 `ListItem`, `data/cafes.json` 시드 기준으로 생성해 검증 완료)은
같은 폴더의 `itemlist.json`에 있다. **이 파일은 하드코딩용이 아니라 스니펫 검증용 예시다** — 실제 구현은 아래 3-3절처럼
런타임 `cafes` 배열에서 생성해야 한다(`lib/cafes.ts`가 유일한 데이터 이음매라는 이 저장소의
규칙과 같은 이유 — 두 번째 데이터 소스를 만들면 반드시 어긋난다).

### 3-3. 구현 스니펫 (`app/page.tsx`에 붙이는 방법)

```tsx
// lib/schema.ts (신규)
import type { Cafe } from '@/types/cafe';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const DAYS = [
  'https://schema.org/Monday', 'https://schema.org/Tuesday', 'https://schema.org/Wednesday',
  'https://schema.org/Thursday', 'https://schema.org/Friday', 'https://schema.org/Saturday',
  'https://schema.org/Sunday',
] as const;

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko-KR',
  };
}

export function buildCafeListSchema(cafes: Cafe[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '카공맵 — 노트북 작업하기 좋은 카페',
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: cafes.length,
    itemListElement: cafes.map((cafe, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'CafeOrCoffeeShop',
        name: cafe.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: cafe.address,
          addressCountry: 'KR',
        },
        geo: { '@type': 'GeoCoordinates', latitude: cafe.lat, longitude: cafe.lng },
        ...(cafe.naver_place_url ? { url: cafe.naver_place_url } : {}),
        ...(cafe.photos.length > 0 ? { image: cafe.photos } : {}),
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAYS,
            opens: cafe.is_24h ? '00:00' : cafe.open_time,
            closes: cafe.is_24h ? '23:59' : cafe.close_time,
          },
        ],
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'wifi', value: cafe.wifi },
          { '@type': 'PropertyValue', name: 'outletLevel', value: cafe.outlet },
          { '@type': 'PropertyValue', name: 'noiseLevel', value: cafe.noise },
          { '@type': 'PropertyValue', name: 'workFit', value: cafe.work_fit },
          { '@type': 'PropertyValue', name: 'lastVerified', value: cafe.last_verified },
        ],
      },
    })),
  };
}
```

```tsx
// app/page.tsx — export const revalidate = 300은 그대로 둔다. JSON-LD도 정적 fetch 값이라 캐시와 무관하다.
import MapView from '@/components/map/MapView';
import { getCafes } from '@/lib/cafes';
import { buildCafeListSchema, buildWebSiteSchema } from '@/lib/schema';

export const revalidate = 300;

export default async function Home() {
  const cafes = await getCafes();
  const schemas = [buildWebSiteSchema(), buildCafeListSchema(cafes)];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          // </script> 이스케이프 — script 태그 안에 원본 </script>가 그대로 들어가면 HTML이 깨진다
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
      <MapView cafes={cafes} />
    </>
  );
}
```

- `lib/schema.ts`를 새 이음매로 둔 이유는 `lib/cafes.ts`/`lib/bookmarks.ts`와 같다 — 변환
  로직을 한 곳에 모아야 두 번째 소스가 안 생긴다.
- **`noindex`가 걸려 있는 동안에도 이 코드는 넣어도 안전하다.** `robots: { index: false }`는
  검색엔진의 색인 자체를 막는 것이고 JSON-LD 유무와 무관하다. 다만 효과가 없다는 걸 알고
  넣는 것과 착각하고 넣는 건 다르므로 위 0절에 명시했다.

---

## 4. 검증 체크리스트 결과

| 항목 | `WebSite` | `ItemList`/`CafeOrCoffeeShop` |
|---|---|---|
| `@context: https://schema.org` | ✅ | ✅ |
| `@type` 유효/비폐기 | ✅ | ✅ (`CafeOrCoffeeShop`은 `FoodEstablishment > LocalBusiness` 하위, 폐기 목록에 없음) |
| 필수 속성 | ✅ (`name`, `url`) | ✅ (`name`; `address`/`geo`는 권장이며 채움) |
| 값 타입 일치 | ✅ | ✅ (`latitude`/`longitude` number, `opens`/`closes` time 문자열) |
| 플레이스홀더 없음 | ✅ | ✅ (전 필드가 실제 시드 데이터) |
| 절대 URL | ✅ | ✅ (`url`은 `naver_place_url` 원본 그대로 절대경로, `null`이면 생략) |
| ISO 8601 날짜 | N/A | ✅ (`lastVerified`는 `YYYY-MM-DD`) |

---

## 요약

- 카공맵 같은 "제3자 카페 디렉터리"가 `LocalBusiness`/`CafeOrCoffeeShop`을 쓰는 것 자체는
  정당하다. 다만 **SERP 리치 리절트를 만들어내지는 못한다** — 얻는 건 entity 이해도와
  AI 크롤러 파싱 편의성 정도이고, 후자의 실효성은 확인되지 않았다.
- `AggregateRating`은 뺐다. 페이지가 SSR로 확정 제공하는 값이 아니고, good/bad 두 값이라
  스케일도 안 맞는다.
- 카페별 URL이 없다는 게 가장 큰 제약이다. `item.url`은 대신 `naver_place_url`을 썼고,
  ItemList 캐러셀 자격은 애초에 없다 — `/cafe/[slug]` 라우트가 생기기 전까지는 바뀌지 않는다.
- `Organization`은 실체(팀·About 페이지)가 없어 보류했다. `WebSite` 단독으로 충분하다.
- 구현은 `lib/schema.ts`를 새 이음매로 만들어 `app/page.tsx`가 이미 들고 있는 `cafes`
  배열에서 생성하는 방식을 권장했다 — `data/cafes.json`을 다시 읽거나 하드코딩하지 않는다.
