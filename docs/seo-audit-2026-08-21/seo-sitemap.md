# Sitemap 분석 — cagongmap-nu.vercel.app

## 확인한 사실 (오케스트레이터 제공 + 코드 확인)

- `/sitemap.xml` 404, `app/sitemap.ts` 없음.
- `app/robots.ts`: `allow: '/'` 전체 허용, `host` 설정, sitemap 필드 없음. 이미 주석으로
  "sitemap은 두지 않는다. 페이지가 하나뿐이고 그마저 noindex다"라고 명시적으로 밝혀둔 상태.
- 공개 라우트는 `/` 하나. `app/auth/callback/route.ts`는 `GET` 요청이 오면 `code`가 있든
  없든 **즉시 `NextResponse.redirect`로 `/`(또는 `/?auth_error=...`)로 302를 쏘고 끝**이다.
  렌더되는 콘텐츠가 없는 순수 리다이렉트 엔드포인트.
- `app/layout.tsx`의 `metadata.robots`가 `{ index: false, follow: false }` — 사진 9장 이용
  권리 미확인 때문에 **`/`조차 noindex**다.
- 카페 9곳은 `MapView` 안 클라이언트 패널에서만 렌더되고 자체 URL이 없다 (`lib/cafes.ts`
  `toCafe()` 확인 — `Cafe.id`는 마커·상세를 잇는 클라이언트 키일 뿐, 라우트가 아니다).

## 1. 페이지가 하나뿐인데 sitemap이 의미가 있나 — 직답

**지금은 의미가 없는 정도가 아니라 오히려 역효과다.** 이유 둘.

1. **sitemap의 존재 이유는 "발견하기 어려운 URL을 알려주는 것"이다.** 루트 URL(`/`)은
   발견이 어려운 URL이 아니다 — `robots.txt`를 요청하는 크롤러는 도메인 루트를 이미 알고
   있다. 링크가 하나뿐인 사이트에서 sitemap은 robots.txt가 이미 하는 일("여기 사이트가
   있다")을 XML로 한 번 더 반복할 뿐, 새로운 정보를 주지 않는다.
2. **더 중요한 문제 — `/`가 `noindex`다.** sitemap에 URL을 올리는 것은 "이 페이지를
   색인해 달라"는 요청인데, 같은 URL의 응답 헤더/메타에 `noindex`가 박혀 있으면 신호가
   충돌한다. Google Search Console은 이 상태를 "Submitted URL marked 'noindex'"로 분류해
   경고를 쌓는다. 지금 sitemap을 추가하면 **Search Console에 등록도 안 했는데 등록하는
   순간 경고부터 발생하는** 상황을 스스로 만드는 셈이다.

즉 `app/robots.ts`에 이미 적힌 "sitemap은 두지 않는다" 판단은 **현재 상태 기준으로
정확하다.** 뒤집을 필요 없음. sitemap이 값을 갖기 시작하는 조건은 다음 **둘 다** 충족될
때다.

- 사진 이용 권리가 정리되어 `layout.tsx`의 `robots: { index: false }` 줄이 빠질 때 (문서에
  이미 "사진을 교체하면 이 줄을 지운다"고 명시돼 있음)
- URL이 하나 이상으로 늘어날 때 (카페별 라우트 등, 아래 2번)

## 2. 카페별 라우트가 생긴다면 — sketch

### 오늘 (라우트 1개)

```ts
// app/sitemap.ts — 만약 지금 추가한다면 (권장하지 않음, 이유는 1번 참고)
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date() }];
}
```

URL 하나짜리 sitemap은 robots.txt 대비 얻는 게 없고, noindex와 충돌한다는 게 1번의 결론.

### 카페별 라우트(`app/cafe/[slug]/page.tsx` 같은 것)가 생긴 미래

이 경우 sitemap은 진짜 일을 하게 된다 — 카페 상세 URL은 홈의 클라이언트 패널 안에만
있어서(서버 렌더 링크가 아니라 지도 마커 클릭으로 열리는 패널) 크롤러가 발견하기 어려운
URL이 되기 때문이다.

```ts
// app/sitemap.ts (future — per-cafe routes 도입 시)
import type { MetadataRoute } from 'next';
import { getCafes } from '@/lib/cafes';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cafes = await getCafes();

  return [
    { url: SITE_URL, lastModified: new Date() },
    ...cafes.map((cafe) => ({
      url: `${SITE_URL}/cafe/${cafe.id}`, // Cafe.id === places.slug
      lastModified: cafe.last_verified, // "YYYY-MM-DD" — 실제 확인일, boilerplate 아님
    })),
  ];
}
```

주의할 점 셋.

- **`priority`/`changeFrequency`는 넣지 않는다.** Google이 무시한다고 이미 알려져 있고,
  `app/robots.ts`의 documentation 톤(불필요한 것을 안 넣는다)과도 맞는다.
- **`lastModified`는 `places.last_verified`를 그대로 쓴다.** CLAUDE.md에 이미 "현재 값은
  전부 임시로 채운 오늘 날짜"라고 적혀 있으므로, 실사용 전에는 이 필드가 진짜 "마지막
  유의미한 변경일"을 반영하도록 정리가 먼저다. 배포 시각이나 빌드 시각을 넣으면 안 된다
  — "모든 URL이 lastmod 동일" 경고(표의 Low 항목)를 스스로 만드는 것과 같다.
- **9곳 규모에서는 캡(50,000 URL / 50MB)에 전혀 걸리지 않는다.** `generateSitemaps` 분할은
  불필요하다. `getCafes()`가 slug가 없는(제보만 되고 아직 승인 전인) 카페를 걸러내는지는
  라우트를 설계할 때 같이 정해야 한다 — `toCafe()` 주석에 "slug가 없으면 uuid로 버틴다"고
  돼 있는데, 그 uuid 경로를 공개 라우트로 만들 계획이 없다면 sitemap에서도 slug가 있는
  카페만 걸러야 한다.

이건 SEO 관점의 sketch일 뿐, "카페별 라우트를 만들지 여부" 자체는 이 감사 범위 밖의
아키텍처 결정이다. `docs/scope.md`·`mvp-decisions.md`에 아직 없는 논의이므로, 만들기로
정해지면 문서에 먼저 반영하고 코드를 붙이는 이 저장소 관행을 따르면 된다.

## 3. `app/robots.ts` 수정 여부

### sitemap 참조 — 추가하지 않는다

지금 추가하면 가리킬 파일이 없어 깨진 참조이고, 설령 1번의 트리비얼 sitemap을 같이
만들어도 `/`가 noindex인 한 참조할 이유가 없다(2번 결론과 동일한 충돌). **noindex가
풀리고 URL이 둘 이상이 되는 시점에 함께 추가**하면 된다. 그때는:

```ts
return {
  rules: { userAgent: '*', allow: '/' },
  host: SITE_URL,
  sitemap: `${SITE_URL}/sitemap.xml`,
};
```

### `/auth/callback` Disallow — 추가를 권장 (사소하지만 비용이 없음)

`Disallow: /`는 요청대로 권장하지 않는다 — 슬랙 등 링크 펼치기 봇이 robots.txt를 지키므로
전체 차단은 공유 카드까지 죽인다. 그런데 **`/auth/callback` 하나만 콕 집어 막는 것은 카드
노출과 무관**하다. 이유:

- 이 라우트는 렌더 결과물이 없는 302 리다이렉트 엔드포인트다. 색인 대상 콘텐츠 자체가
  없으므로 애초에 사이트 어디에도 `<a href="/auth/callback">` 링크가 없다 — 크롤러가
  자연 발견할 경로가 없다는 뜻이다.
- 그래도 넣는 이유는 방어 비용이 0에 가깝기 때문이다. Search Console에 `code`/`error`
  쿼리스트링이 붙은 URL이 어떤 경로로든(레퍼러 유출, 서드파티 분석 도구 등) 노출될 가능성을
  원천 차단하고, "이 경로는 페이지가 아니라 핸들러"라는 의도를 robots.txt에 명시적으로
  남긴다. `/`를 여는 것과 별개로 얼마든지 병행 가능하다.

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/auth/callback' },
    host: SITE_URL,
  };
}
```

## 4. 결론 — 지금 이 커밋에서 할 일

**아무 파일도 바꾸지 않는 것을 권장한다.** 근거:

- `app/sitemap.ts`: 추가하지 않는다. `/`가 noindex인 한 sitemap은 "제출하자마자 경고가
  나는" 상태를 스스로 만든다. `app/robots.ts`의 기존 주석이 이미 맞는 판단을 하고 있다.
- `app/robots.ts`의 sitemap 참조: 추가하지 않는다. 가리킬 파일이 없다.
- `app/robots.ts`의 `Disallow: /auth/callback`: **추가해도 안전하고 사소한 위생 개선이지만,
  지금 아무것도 새는 게 없으므로 급하지 않다.** 원하면 한 줄로 반영 가능 (3번 코드 참고).

**재검토할 시점**은 사진 이용 권리가 정리되어 `app/layout.tsx`의 `robots: { index: false }`
줄을 지우는 순간이다. 그때 홈 하나짜리 sitemap을 넣을지, 그 전에 카페별 라우트부터
만들지를 같이 정하면 된다 — 라우트 없이 sitemap만 먼저 넣으면 2번에서 지적한 "카드는 좋은데
줄 값 있는 콘텐츠가 없는" sitemap이 된다.
