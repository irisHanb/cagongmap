# 검색·공유·폴백 화면

## `/cafes` — 지도가 아닌 유일한 화면

지도는 크롤러와 LLM에게 빈 화면이다. `/`가 서버에서 내보내는 본문 텍스트는 **46자**였고
카페 9곳은 전부 클라이언트에서 그려졌다. `/cafes`가 그것을 1222자로 바꾼다.

- **서버 컴포넌트다.** `'use client'`를 붙이는 순간 이 페이지를 만든 이유가 사라진다.
- `/`의 Map Shell은 그대로다. 목록을 dock에 쌓지 않고 별도 라우트로 뺀 이유가 그것이다
  (`DESIGN.md` — Cafe List Page).
- **검색·필터를 두지 않는다.** 그것은 여전히 2차다.
- 카페별 페이지(`/cafe/[slug]`)는 아직 없다. 9곳이라 목록 하나로 충분하고, 개별 페이지는
  카페마다 쓸 글이 생긴 뒤가 순서다. 그게 생기면 sitemap도 그때 의미를 갖는다.

## `lib/schema.ts` — JSON-LD 이음매

`lib/cafes.ts`와 같은 규칙 — **컴포넌트가 스키마를 직접 조립하지 않는다.**

- `websiteSchema()`는 `/`와 `/cafes` 둘 다에, `cafeListSchema()`는 **`/cafes`에만** 붙는다.
  구조화 데이터는 그 페이지에 실제로 있는 것을 반영해야 하는데, `/`의 카페는 서버 렌더
  콘텐츠가 아니라 지도 위 마커다.
- **`AggregateRating`을 넣지 않는다.** 리뷰 집계는 `useEffect`로 클라이언트에서 붙는 값이라
  SSR된 HTML에 없다. good/bad 두 값이라 `ratingValue` 스케일과도 맞지 않는다.
- 카페별 URL이 없어 `item.url`은 `naver_place_url`을 쓴다. `/cafe/[slug]`가 생기면 바꾼다.
- ⚠️ 사이트 전체가 `noindex`인 동안 이 마크업은 Google 노출로 이어지지 않는다.

## 공유 메타데이터 — 링크를 열기 전 화면

첫 사용자에게 주소를 보내는 것이 이 습작의 유일한 배포 경로라, 링크를 펼쳤을 때 뜨는
카드가 사실상 첫 화면이다.

- **사이트 주소는 `lib/site.ts` 하나에서 나온다.** `NEXT_PUBLIC_SITE_URL`을 읽고 없으면
  현재 배포 주소로 떨어진다. `metadataBase`·canonical·og:image 절대 URL이 전부 이 값에
  걸려 있다.
  - **Next 16은 `metadataBase` 없이 상대 경로를 쓰면 경고가 아니라 빌드 에러를 낸다.**
  - 카카오톡·디스코드 스크래퍼는 상대 경로 og:image를 읽지 못한다. 이 값이 틀리면
    카드에서 이미지만 빠진다.
  - ⚠️ **dev에서는 og:image가 localhost로 나온다.** Next가 요청 origin을 쓰기 때문이며
    버그가 아니다. 확인은 `npm run build && npm start`로 한다.
- **`app/opengraph-image.tsx`가 og:image·twitter:image 태그를 만든다.** 파일 컨벤션이라
  Next가 알아서 붙이므로 **`layout.tsx`에 `openGraph.images`를 적지 않는다.** 두 군데
  적으면 반드시 어긋난다.
  - **satori는 woff2를 못 읽는다.** layout.tsx가 쓰는 dynamic subset(woff2) 말고
    `woff-subset`의 woff를 읽는다. 이걸 woff2로 바꾸면 글자가 통째로 사라진다.
  - **한글 줄바꿈을 직접 끊는다.** satori는 글자 단위로 끊어서 흘려보내면
    "지도에서 찾 / 습니다"처럼 낱말 가운데가 갈린다.
  - 데이터를 읽지 않으므로 빌드 때 정적으로 만들어진다. 카페 수 같은 바뀌는 값을 넣으면
    이 성질이 깨지고, 스크래퍼가 오래 캐시하므로 어차피 옛 값이 된다.
- **브랜드 마크의 원본은 `app/icon.svg` 하나다.** `app/favicon.ico`는 거기서 뽑은
  래스터이고(`node scripts/generate-favicon.mjs`), `app/apple-icon.tsx`도 같은 모양을
  다시 그린다. **셋 중 하나를 고치면 나머지도 고친다.**
- ⚠️ **색인 차단은 `robots.txt`가 아니라 meta로 한다.** 슬랙의 링크 펼치기 봇이
  `robots.txt`를 지키므로 `Disallow: /`를 두면 **공유 카드까지 같이 사라진다.**
  `app/robots.ts`는 전부 허용하고, `layout.tsx`의 `robots: { index: false }`가 색인만
  막는다 — 스크래퍼는 그 태그를 보지 않는다.
  - 막아 둔 이유는 사진 9장의 이용 권리가 미확인이기 때문이다. **사진을 교체하면 그 줄을
    지운다.**
- **`proxy.ts` matcher에서 `opengraph-image`·`apple-icon`·`robots.txt`를 뺐다.** 확장자가
  없어서 확장자 목록을 빠져나가는데, 스크래퍼가 카드를 가져갈 때마다 Supabase
  `getUser()`가 한 번씩 돈다.

## 폴백 화면 (404 · 에러)

- Next 기본 404는 **영어 한 줄이고 `prefers-color-scheme`을 따라간다.** 이 저장소는 라이트
  팔레트 하나뿐이라(`DESIGN.md`) 그대로 두면 `lang="ko"` 문서 안에 검은 영어 화면이 뜬다.
  `app/not-found.tsx`가 그걸 덮는다.
- ⚠️ **`error.tsx`의 두 번째 prop은 `reset`이 아니라 `retry`다.** Next 16에서 바뀌었고,
  기존 예제를 그대로 옮기면 버튼이 아무 일도 하지 않는다. `reset`은 아직 있지만 다시
  가져오지 않고 다시 그리기만 하므로 데이터 실패에는 쓸모가 없다.
- **`app/global-error.tsx`는 `globals.css`도 폰트도 닿지 않는다.** 루트 레이아웃을
  대체하기 때문이다. 그래서 인라인 스타일이고 색이 리터럴이다 — **하드코딩된 색이 허용되는
  유일한 파일이다.** 여기서 CSS를 import하면 그 CSS가 못 뜨는 상황에서 화면이 통째로 사라진다.
- 클라이언트 컴포넌트라 `metadata`를 export할 수 없다. 제목은 React의 `<title>`로 단다.
- **`revalidate = 300` 때문에 에러 화면을 확인하기 어렵다.** 일부러 던지게 고쳐도 캐시된
  결과가 나온다. `rm -rf .next/cache` 뒤에 확인한다.

## 감사 기록

`docs/seo-audit-2026-08-21/`은 특정 시점 스냅샷이라 갱신하지 않는다. 다시 감사하면
새 폴더를 만든다.
