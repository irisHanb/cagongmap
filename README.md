# 카공맵

노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. 인프런 VC 클래스 습작 MVP다.

- 배포: https://cagongmap-nu.vercel.app
- 권역: 송파·잠실·강남, 수기 큐레이션 9곳
- 콘센트·와이파이·소음·좌석·영업시간을 카드 한 장에서 본다

## 무엇이 되어 있나

| 기능 | 상태 |
|---|---|
| 카카오맵 마커 + dock 카페 목록·검색 | 있음 |
| 카페 목록 페이지 (`/cafes`, 서버 렌더) | 있음 |
| 카카오 로그인 (Supabase OAuth) | 있음 |
| 북마크 | 로그인 사용자별 저장 |
| 리뷰 칩 (콘센트·소음 등 항목별 투표) | 집계는 `place_review_counts()` RPC로만 읽는다 |
| 새 장소 제보 · 기존 장소 수정 요청 | 사진 첨부 포함, 테이블 둘로 나뉜다 |
| 관리자 검수 (`/admin`) | `profiles.role`이 `curator`·`admin`일 때만 |
| 카공 허용 여부(`work_policy`) | 컬럼만 있고 9곳 전부 null이다 — 방문 확인이 필요하다 |

## 시작하기

```bash
npm install
cp .env.example .env.local   # 키를 채운다
npm run dev                  # http://localhost:3030
```

**포트는 3030 고정이다.** 카카오 콘솔에 등록된 플랫폼 도메인이 `http://localhost:3030`이라
다른 포트로 띄우면 지도가 뜨지 않는다.

`.env.local`에 카카오맵 JavaScript 키와 Supabase URL·anon 키가 있어야 한다. 자세한 내용은
`.env.example`의 주석에 있다.

| 변수 | 없으면 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 대신 안내 문구가 렌더된다 — 의도된 폴백이다 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase-env.ts`가 즉시 throw한다 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같다 |

`NEXT_PUBLIC_` 접두사라 값을 바꾸면 개발 서버를 재시작해야 반영된다.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (3030) |
| `npm run build` | 프로덕션 빌드 — 타입체크가 함께 돈다 |
| `npm start` | 프로덕션 실행 (3030) |
| `npm run verify` | lint → typecheck → test. 커밋 훅이 부르는 것도 이것이다 |
| `npm run test` | vitest watch |
| `npm run typecheck` | `next typegen` 뒤에 `tsc --noEmit`. `tsc`만 부르면 Next 전역 타입을 몰라 실패한다 |

커밋할 때마다 `.githooks/pre-commit`이 `npm run verify`를 돌린다. 실패하면 커밋이 멈춘다.

## 화면

| 경로 | 내용 |
|---|---|
| `/` | 카카오맵 + 마커 + dock 목록·검색. 본문은 클라이언트에서 그려진다 |
| `/cafes` | 카페 전체 목록. 크롤러와 LLM이 읽을 수 있는 유일한 화면이라 서버 컴포넌트다 |
| `/admin/reports` | 대기 중 제보·수정 요청 검수 (`/admin`은 여기로 리다이렉트한다) |
| `/admin/places` | 카페 등록·수정 |
| `/auth/callback` | 카카오 OAuth 콜백 |

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (new-york, Radix UI 프리미티브 기반) · lucide 아이콘 · sonner 토스트 ·
Supabase (Postgres · Auth · Storage) · 카카오맵 JavaScript SDK · Vitest ·
Vercel 배포.

`components/ui/*`는 shadcn CLI로 받아 저장소에 복사한 뒤 `DESIGN.md` 규격으로 고친
파일이다 (`components.json`이 그 설정). 예를 들어 `button.tsx`는 `destructive`
variant와 `dark:` 클래스를 지웠다 — 팔레트가 라이트 하나뿐이고, 색이 드는 것은 좋은
조건뿐이라는 규칙이 있다. **업스트림에서 다시 받아 덮어쓰면 그 수정이 사라진다.**

## 구조 — 컴포넌트는 DB를 직접 부르지 않는다

DB·Storage·외부 SDK에 닿는 코드는 `lib/`에만 둔다. 컴포넌트 36개 중 Supabase
클라이언트를 직접 부르는 것은 `components/auth/AuthProvider.tsx` 하나뿐이고(세션 자체가
그 컴포넌트의 관심사다), 나머지는 전부 `lib/`의 함수를 부른다.

**같은 변환 코드를 두 벌 만들지 않는다.** 두 벌이 되면 컬럼이 하나 늘 때 한쪽만 고쳐져
어긋난다.

| 변환 | 사는 곳 | 같이 쓰는 곳 |
|---|---|---|
| `places` row → `Cafe` | `lib/cafes.ts`의 `toCafe()` | 카페 조회, 북마크 조회 |
| slug → `places.id`(uuid) | `lib/place-id.ts` | 북마크 · 리뷰 · 제보 |
| 버킷 경로 ↔ 공개 URL | `lib/place-images.ts` | `toCafe()`, 관리자 폼 |

**형태 변환은 `lib/`에서 끝낸다.** `places.photos`에는 버킷 오브젝트 경로가 들어 있고
`Cafe.photos`에는 `<img src>`에 바로 넣을 공개 URL이 들어 있다. 변환하는 곳은
`toCafe()`의 `row.photos.map(placeImageUrl)` 한 줄이라 **컴포넌트는 사진이 어느 버킷에서
오는지 모른다.**

이 규칙이 산 것 둘 — 저장소를 JSON에서 Supabase로 갈아탈 때 컴포넌트가 한 줄도 바뀌지
않았고(`getCafes()` 내부만 바뀌었다), 테스트는 `@/lib/supabase-browser` 하나만 가짜로
바꾸면 `lib/bookmarks`·`lib/reviews`가 실제 코드로 돈다.

```
app/          라우트 (지도 · 카페 목록 · 관리자 · 인증 콜백)
components/   map · cafe · auth · bookmark · review · submission · admin · ui(shadcn)
lib/          데이터 접근과 도메인 로직. DB·SDK를 만지는 곳은 여기뿐이다
types/        Cafe 타입과 enum 라벨, 카카오 SDK 타입 선언
supabase/     마이그레이션 (스키마 · RLS · 승인 RPC)
data/         cafes.json — 시드 마이그레이션을 만드는 입력이지 런타임 원본이 아니다
scripts/      시드 생성 · 고아 사진 정리 · 파비콘 생성
test/         테스트 픽스처 (테스트 파일은 대상 파일 옆에 둔다)
```

런타임 원본은 Supabase `places` 테이블이다. 앱의 키는 `places.slug`이고, `toCafe()`가
그것을 `Cafe.id`로 옮긴다.

## 검증

`npm run verify`가 통과한 것과 화면이 도는 것은 다르다. UI를 건드렸으면 실제로 띄워서
확인한다. 자동 테스트는 로직만 보고 레이아웃·SDK 초기화·하이드레이션은 보지 않는다.

## 데이터 수집 원칙

**크롤링하지 않는다.** 카카오맵 API는 응답 데이터의 별도 저장을 약관으로 금지한다.
카페 데이터는 수기 큐레이션으로만 채우고, `last_verified`(확인일)를 화면에 그대로
노출한다 — 신선도를 숨기지 않는 것이 명시적 결정이다.

## 문서

| 문서 | 역할 |
|---|---|
| `CLAUDE.md` | 아키텍처와 이 저장소에서 밟기 쉬운 함정 |
| `DESIGN.md` | 색·타이포·간격 토큰과 그 사용 규칙 |
| `docs/code-guide.md` | 코드 작성 기준 (KISS·DRY·경계) |
| `docs/scope.md` | 무엇을 만들고 무엇을 미루는지 |
| `docs/mvp-decisions.md` | 구속력 있는 제약과 근거 |
| `docs/db-schema.md` | 테이블과 RLS 정책 |
| `docs/ugc.md` | 리뷰·제보 테이블과 승인 함수 |
| `docs/images.md` | 사진 경로·버킷·정리 |
| `docs/seo.md` | 검색·공유 카드·404 |
| `docs/ci.md` | pre-commit과 GitHub Actions |

## 아직 공개 전이다

지도에 걸린 사진 9장은 연습용 임시본이고 이용 권리를 확인하지 않았다. 그래서 지금은
`robots` 메타로 검색 색인을 막아 두었다(`app/layout.tsx`). 사진을 교체한 뒤에 푼다.
