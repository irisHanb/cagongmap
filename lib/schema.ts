import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import { NOISE_LABEL, OUTLET_LABEL, WORK_POLICY_LABEL } from '@/types/cafe';
import type { Cafe } from '@/types/cafe';

/**
 * ★ JSON-LD 조립
 *
 * lib/cafes.ts와 같은 규칙이다 — 컴포넌트가 스키마를 직접 조립하지 않는다.
 * 2026-08-21 SEO 감사에서 JSON-LD가 0개로 나와 넣었다
 * (docs/seo-audit-2026-08-21/seo-schema.md).
 *
 * ⚠️ 지금은 사이트 전체가 noindex다(사진 이용 권리 미확인). 그래서 이 마크업이
 * 당장 Google 노출로 이어지지는 않는다. 넣는 이유는 noindex를 푸는 날의 준비와
 * LLM 크롤러의 파싱 편의 두 가지이고, 후자의 실효성은 확인된 바 없다.
 *
 * 넣지 않기로 한 것들:
 * - AggregateRating — place_reviews 집계는 클라이언트에서 붙는 값이라 SSR된 HTML에
 *   없다. 페이지에 없는 것을 마크업하지 않는다. good/bad 두 값이라 ratingValue의
 *   숫자 스케일과도 맞지 않는다.
 * - Organization — 팀도 About 페이지도 없다. WebSite 하나로 충분하다.
 * - priceRange — iced_americano_price는 메뉴 한 항목의 값이지 매장 가격대가 아니다.
 */

/** JSON-LD 한 덩어리. 컴포넌트는 이 타입만 보고 <script>에 넣는다 */
export type JsonLd = Record<string, unknown>;

/**
 * `<script>` 안에 넣을 문자열. **`JSON.stringify()`를 직접 부르지 않는다.**
 *
 * HTML 파서는 `<script>` 안에서도 `</script`를 찾으면 거기서 블록을 닫는다. JSON
 * 문자열에 그 일곱 글자가 들어 있으면 뒤가 통째로 마크업이 되고, 그 뒤에 무엇을
 * 적을지는 값을 넣은 사람이 정한다.
 *
 * 지금 이 함수를 지나는 값(카페 이름·주소)은 큐레이터가 폼으로 넣은 것이라 당장
 * 뚫리지는 않는다. 그래도 두는 이유는 **한 칸 건너면 사용자 입력이기 때문이다** —
 * `place_reports.place_name`은 제보자가 직접 적고, `app/admin/places/new/page.tsx`가
 * 그 값을 `places.name` 칸에 그대로 깔아 준다. DB 제약은 공백과 100자만 보므로
 * `</script>`가 들어갈 자리가 남는다. 남은 방어선이 "큐레이터가 저장 전에 이름을
 * 눈으로 본다" 하나가 되는데, 그것은 코드의 성질이 아니다.
 *
 * `<`를 통째로 바꾼다 — `</script`만 노리면 `<!--`가 남는다. `\u003c`는 JSON에서
 * `<`와 같은 값이라 파서가 읽는 결과는 바뀌지 않는다.
 */
export function jsonLdText(schema: JsonLd | JsonLd[]): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export function websiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_TITLE,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko-KR',
  };
}

/**
 * 카페 한 곳. 소유하지 않은 매장을 CafeOrCoffeeShop으로 적는 것은 디렉터리
 * 사이트의 일반적인 관행이고, 여기 적는 값은 전부 화면에 실제로 보이는 것이다.
 *
 * url은 naver_place_url을 쓴다. 카공맵에는 아직 카페별 URL이 없기 때문이다
 * (`/cafe/[slug]`가 생기면 그때 자체 URL로 바꾼다). 없으면 필드를 뺀다 —
 * 빈 문자열을 넣으면 파서가 깨진다.
 */
function cafeSchema(cafe: Cafe): JsonLd {
  const properties: JsonLd[] = [
    { '@type': 'PropertyValue', name: '콘센트', value: OUTLET_LABEL[cafe.outlet] },
    { '@type': 'PropertyValue', name: '소음', value: NOISE_LABEL[cafe.noise] },
    { '@type': 'PropertyValue', name: '확인일', value: cafe.last_verified },
  ];
  // 값이 있는 카페에만. 시드 9곳은 전부 null이다 (scope.md 미확정 이슈 ②).
  if (cafe.work_policy) {
    properties.push({
      '@type': 'PropertyValue',
      name: '카공 허용',
      value: WORK_POLICY_LABEL[cafe.work_policy],
    });
  }

  return {
    '@type': 'CafeOrCoffeeShop',
    name: cafe.name,
    address: { '@type': 'PostalAddress', streetAddress: cafe.address, addressCountry: 'KR' },
    geo: { '@type': 'GeoCoordinates', latitude: cafe.lat, longitude: cafe.lng },
    ...(cafe.naver_place_url ? { url: cafe.naver_place_url } : {}),
    ...(cafe.photos.length > 0 ? { image: cafe.photos[0] } : {}),
    // 와이파이는 amenityFeature가 맞는 자리다. 콘센트·소음은 schema.org에 대응하는
    // 개념이 없어 additionalProperty로 뺐다 — 억지로 amenityFeature에 넣지 않는다.
    amenityFeature: [
      {
        '@type': 'LocationFeatureSpecification',
        name: '무료 와이파이',
        value: cafe.wifi,
      },
    ],
    additionalProperty: properties,
    ...(cafe.is_24h
      ? { openingHours: 'Mo-Su 00:00-23:59' }
      : cafe.open_time && cafe.close_time
        ? { openingHours: `Mo-Su ${cafe.open_time}-${cafe.close_time}` }
        : {}),
  };
}

/**
 * 목록 페이지용. ItemList 캐러셀 리치 리절트 자격은 없다 — 항목이 자체 URL을
 * 가져야 하는데 카공맵에는 카페별 페이지가 없다. entity 이해를 돕는 용도다.
 */
export function cafeListSchema(cafes: Cafe[], url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${SITE_NAME} 카페 목록`,
    url,
    numberOfItems: cafes.length,
    itemListElement: cafes.map((cafe, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: cafeSchema(cafe),
    })),
  };
}
