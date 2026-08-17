# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> `AGENTS.md`는 `next dev`가 실행될 때마다 자동으로 다시 쓰인다. 직접 편집하지 말 것.

## 프로젝트

카공맵 — 노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. **개인 습작 MVP**(인프런 VC 클래스)이며, 사업화가 아니라 학습이 목적이다.

## 명령어

```bash
npm run dev      # 개발 서버 — 포트 3030 고정
npm run build    # 프로덕션 빌드 (여기서 TypeScript 타입체크가 함께 돌아간다)
npm run lint     # eslint
npm start        # 프로덕션 실행 — 포트 3030 고정
```

- **포트는 3030이다.** 카카오 콘솔 플랫폼 도메인이 `http://localhost:3030`으로 등록되어 있어, 다른 포트로 띄우면 지도가 뜨지 않는다.
- **타입체크는 `npx tsc --noEmit`이 아니라 `npm run build`로 한다.** 단독 `tsc`는 Next.js가 생성하는 전역 타입(`LayoutProps` 등)을 모르기 때문에 실패한다.
- 테스트 프레임워크는 아직 없다.

## 환경변수

`.env.local`에 셋이 필요하다.

| 변수 | 없으면 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 대신 안내 문구가 렌더된다 — 의도된 폴백이다 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`가 즉시 throw한다 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같다 |

Supabase 쪽은 폴백을 두지 않았다. 원본이 하나여야 하는데 조용히 JSON으로 되돌아가면 화면이 실제 DB와 다른 것을 보여주기 때문이다.

`NEXT_PUBLIC_` 접두사이므로 값을 바꾸면 **개발 서버를 재시작해야** 반영된다.

카카오맵 무료 쿼터는 **개발자 계정의 첫 활성화 앱 1개에만** 제공된다. 새 앱을 만들지 말고 기존 앱을 쓴다.

## 아키텍처

### `lib/cafes.ts` — 데이터 이음매 (이 구조의 핵심)

**컴포넌트는 카페 데이터를 직접 가져오지 않는다.** 모든 데이터 접근은 `getCafes()` / `getCafeById()`를 통한다.

원본은 이제 Supabase `places` 테이블이다(`lib/supabase.ts` 경유). JSON에서 DB로 갈아탈 때 컴포넌트는 한 줄도 바뀌지 않았다 — 이 이음매를 열어둔 이유가 그것이다. **이 규칙을 깨면 의미가 사라진다.**

- 앱의 키는 `places.slug`다(`naruteo`). `places.id`(uuid)가 아니다 — `toCafe()`가 `slug`를 `Cafe.id`로 옮긴다.
- `select('*')`를 쓰지 않는다. `COLUMNS` 상수는 **한 줄 리터럴이어야** supabase-js가 결과 타입을 추론한다.
- `app/page.tsx`의 `export const revalidate = 300`이 캐싱을 정한다.

### 인증 (Supabase + 카카오 OAuth)

Supabase 클라이언트가 셋이다. **역할이 달라서 나눈 것이지 취향이 아니다.**

| 파일 | 쓰는 곳 | 세션 |
|---|---|---|
| `lib/supabase.ts` | `lib/cafes.ts` — 공개 카페 조회 | 없음 (`persistSession: false`) |
| `lib/supabase-browser.ts` | 클라이언트 컴포넌트 | 쿠키 |
| `lib/supabase-server.ts` | route handler, 서버 액션 | 쿠키 |

- **공개 조회에 세션 클라이언트를 쓰지 않는다.** 쿠키를 읽는 순간 `app/page.tsx`의
  `revalidate = 300`이 죽고 요청마다 동적 렌더가 된다. 카페 목록은 로그인과 무관하다.
- 같은 이유로 **`AuthDock`이 세션을 클라이언트에서 읽는다.** 서버 컴포넌트에서 유저를
  꺼내면 페이지 전체가 동적이 된다. 판정 전에는 버튼도 프로필도 그리지 않는다.
- 환경변수 검사는 `lib/supabase-env.ts` 하나뿐이다. 셋이 같은 검사를 따로 하지 않는다.
- **세션 갱신 파일은 `middleware.ts`가 아니라 `proxy.ts`다.** Next 16에서 이름이 바뀌었다.
  Supabase 공식 문서의 `middleware.ts` 예제를 그대로 옮기면 파일이 조용히 무시된다.
- **PKCE라 콜백 교환을 서버에서 한다** (`app/auth/callback/route.ts`). code verifier가
  쿠키에 있다.
- **사용자 이름·avatar는 `user_metadata`에서 읽는다** (`profiles` 테이블이 아니라).
  카카오가 주는 키가 동의항목에 따라 갈리므로 `name`/`full_name`/… 순서로 훑는다.
  **이메일은 선택 동의라 없을 수 있다** — 없으면 줄을 뺀다.
- 카카오 avatar는 `next/image`를 쓰지 않는다. `next.config.ts`의 `remotePatterns`가
  Supabase Storage만 열어둔 것을 avatar 하나 때문에 넓히지 않는다.

콘솔 설정 두 가지가 맞아야 로그인이 돌아간다.

- Supabase → Authentication → URL Configuration의 Redirect URLs에 `http://localhost:3030/**`
- 카카오 개발자 콘솔 Redirect URI에 `https://<project-ref>.supabase.co/auth/v1/callback`

### 북마크

- **`lib/bookmarks.ts`가 이음매다.** `lib/cafes.ts`와 같은 규칙 — 컴포넌트는 `bookmarks`
  테이블을 직접 건드리지 않는다. 다른 점은 세션 클라이언트를 쓴다는 것뿐이고, 그래서
  **이 파일은 브라우저 전용이다.** 서버에서 부르면 세션이 없어 빈 목록이 돌아온다.
- **places row → Cafe 변환은 `lib/cafes.ts`의 `toCafe()` 하나뿐이다.** 북마크 조회도
  `PLACE_COLUMNS`와 `toCafe`를 빌려 쓴다. 두 번째 변환 코드를 만들면 두 경로가 반드시
  어긋난다.
- **`bookmarks.place_id`는 uuid FK인데 앱 키는 slug다.** `resolvePlaceId()`가 저장·해제
  때 한 번 변환한다. 목록 조회는 join이라 변환이 없다.
- **로그인 여부 판정은 `BookmarkProvider.toggle()` 한 곳에 있다.** 버튼마다 두지 않는다.
  로그인이 없으면 저장 대신 `loginPrompt`를 세우고 `MapView`가 모달을 띄운다.
- **북마크 목록에 주인(`userId`)을 같이 들고 렌더 중에 판정한다.** 목록만 들고 로그아웃
  때 비우면 그 일을 effect가 해야 하고, A가 나가고 B가 들어온 순간 B에게 A의 목록이
  잠깐 비친다.
- 저장/해제는 낙관적 갱신이고 실패하면 되돌린다. 하트는 누른 즉시 반응해야 한다.

### 카카오맵 SDK 통합

명령형 SDK를 React에 붙이는 부분이라 규칙이 몇 가지 있다.

- **`autoload=false`로 로드하고 `kakao.maps.load()` 콜백 안에서 지도를 만든다.** 자동 로드에 맡기면 하이드레이션 시점과 어긋나 `kakao is not defined`가 산발적으로 발생한다.
- **`next/script`는 `layout.tsx`가 아니라 `KakaoMap.tsx` 안에 있다.** `onReady`로 초기화 시점을 잡아야 해서 스크립트와 지도 생성 코드가 같은 클라이언트 컴포넌트에 있어야 한다.
- **`MapContext`**가 생성된 지도 인스턴스를 하위로 전달한다. `KakaoMap`이 자식을 알지 않아도 되게 하려는 것이다.
- **마커는 기본 `Marker`가 아니라 `CustomOverlay` + `createPortal`이다** (`CafeMarker`). 대표 사진을 원형으로 자르고 테두리를 두르려면 HTML이어야 한다. `MarkerImage`는 이미지를 아이콘에 그대로 얹을 뿐이라 크롭이 안 된다. 어느 쪽이든 cleanup에서 `setMap(null)`을 반드시 호출한다. 빠뜨리면 유령 마커가 남는다.
- **마커의 포탈 컨테이너는 `useEffect`에서 만든다.** 게으른 초기화로 만들면 서버는 `null`, 클라이언트는 포탈을 내놓아 하이드레이션이 깨진다. 마커는 항상 렌더되므로 이 차이가 매번 드러난다.
- **선택된 마커를 위로 올릴 때는 `overlay.setZIndex()`를 쓴다.** 오버레이마다 SDK가 별도 wrapper를 만들기 때문에 CSS `z-index`로는 형제 마커를 넘지 못한다.
- **지도는 `100dvh` 풀스크린이고 나머지 UI는 전부 그 위에 뜬다** (`DESIGN.md` — Map Shell). dock도 상세 패널도 지도 크기를 바꾸지 않으므로 `relayout()`을 부를 일이 없다. 패널이 지도를 미는 구조로 되돌리면 `relayout` 감시가 다시 필요해진다.
- **`onSelect`는 `useCallback`으로 참조를 고정한다** (`MapView`). 안 하면 렌더마다 마커를 전부 지웠다 다시 만든다.
- `types/kakao.d.ts`는 **직접 작성한 최소 선언**이다. 공식 타입 패키지가 없으므로, 새 SDK API를 쓰면 여기에 먼저 추가해야 한다.

### `lib/openState.ts`

"지금 영업중" 판정. `close_time <= open_time`이면 자정을 넘기는 영업으로 보고 구간을 나눠 OR로 판정한다. 시드에 `12:00~00:00`(나루터)이 실제로 존재하므로 이 경로는 죽은 코드가 아니다. `now`를 주입할 수 있게 열려 있다.

## 디자인 (`DESIGN.md`)

**UI나 CSS를 건드리기 전에 `DESIGN.md`를 먼저 읽는다.** 저장소 루트에 있다.
frontmatter에 색·타이포·radius·간격·그림자·컴포넌트 치수가 토큰으로 박혀 있고,
본문이 그 값을 **어디에 쓰고 어디에 쓰지 않는지**를 정한다. 토큰만 보고 본문을
건너뛰면 안 된다 — 금지 항목(`Don't`)이 본문에만 있다.

- **색·여백·컴포넌트·말투는 `DESIGN.md`가 기준이다.** 눈대중으로 새 값을 만들지 말고
  거기 있는 토큰을 쓴다. placeholder 문구나 버튼 레이블 같은 말투도 포함이다.
- **기준과 어긋나는 변경이 필요하면 코드를 고치기 전에 이유를 먼저 설명한다.**
  무엇이 어떻게 어긋나는지와 왜 그래야 하는지를 말하고 합의한 뒤에 손댄다.
  합의된 예외는 `DESIGN.md`에 반영한다 — 코드만 앞서가면 기준이 죽는다.

### 지금 상태

2026-08-15에 화면을 기준에 맞췄다. 토큰은 `app/globals.css`의 `:root`에 있고, 색·여백·
모서리·그림자를 거기서만 가져다 쓴다. **하드코딩된 색이나 스케일 밖 여백을 새로 만들지 않는다.**

- **다크 모드는 없다.** 팔레트가 라이트 하나뿐이라 `prefers-color-scheme` 분기를 만들지 않는다.
- **부정 상태에는 색을 주지 않는다.** 색이 드는 것은 좋은 조건뿐이다(민트).
- **`work_fit`은 마커 테두리 색으로만 쓴다.** 상세에는 넣지 않는다.
- 폰트는 `pretendard` 패키지의 variable + dynamic subset을 `app/layout.tsx`에서 import한다.

2026-08-15에 카카오 로그인과 북마크가 dock에 들어왔다. 두 번 다 문서
(`scope.md`·`mvp-decisions.md`·`DESIGN.md`)를 먼저 갱신하고 코드를 붙였다.

같은 날 `DESIGN.md`에서 뒤집은 규칙이 둘 있다. 이유가 본문에 적혀 있다.

- **로그인 전에도 상세의 하트는 보인다.** 원래 "로그인 전에는 북마크 UI를 숨긴다"였다.
  저장할 수 있다는 사실 자체가 로그인의 이유라, 그 입구까지 감추면 로그인할 까닭이
  화면에 남지 않는다. 누르면 로그인 모달이 뜬다.
- **저장/해제 버튼이 dock이 아니라 상세 패널에 있다.** 저장은 사진과 Quick Check를
  보면서 판단하는 일이다.

⚠️ 남은 자리: `DESIGN.md` Left Panel의 **4번 검색바만 비어 있다.** `scope.md`가 검색·필터를
2차로 미뤄둔 그대로다. **동작하지 않는 검색바를 먼저 띄우지 않는다.**

## 데이터

런타임 원본은 Supabase `places` 테이블이다. `data/cafes.json`은 시드 마이그레이션
(`supabase/migrations/20260814000003_seed_places.sql`)을 만드는 입력으로만 남아 있다 —
`node scripts/generate-seed.mjs`로 재생성한다. 현재 9곳(송파·잠실 7 + 강남 2).

**이미 적용한 뒤 JSON을 고쳐도 DB에 반영되지 않는다.** 마이그레이션은 한 번만 돌기 때문에,
그때는 새 마이그레이션을 따로 만들거나 Supabase에서 직접 고쳐야 한다.

- **`id`가 키다.** 이름은 바뀌므로 `name`을 키로 쓰지 않는다.
- `last_verified`는 화면에 "확인일"로 노출된다. **현재 값은 전부 임시로 채운 오늘 날짜이며 실제 확인 시점이 아니다.**
- `types/cafe.ts`의 enum은 시드에 아직 등장하지 않는 값(`few`/`none`/`noisy`/`bad`)까지 열어두었다.

## Supabase RLS

**사용자별 데이터가 들어가는 테이블은 RLS를 켠 상태가 기본이다.** anon 키가 브라우저에
그대로 나가므로, RLS가 꺼진 테이블은 곧 누구나 읽고 쓰는 테이블이다. 켜는 것을 나중으로
미루지 않는다.

```sql
alter table public.<table> enable row level security;
```

- **소유자 컬럼이 있으면 `auth.uid()`와 맞춰 본인 row만 허용한다.** 이 저장소의 소유자
  컬럼 이름은 `user_id`가 아니라 테이블마다 다르다 — `profiles.id`,
  `place_submissions.submitted_by`. 이름을 가정하지 말고 스키마를 먼저 본다.
- **`auth.uid()`는 `(select auth.uid())`로 감싼다.** 감싸야 플래너가 행마다가 아니라
  구문당 한 번 평가한다. 기존 정책이 전부 이 형태이므로 새 정책도 맞춘다.
- **정책 안에서 같은 테이블을 select하면 RLS가 재귀한다.** `profiles.role`을 보는 판정은
  `security definer` 함수(`public.is_curator()`)로 빼두었다. 역할 기반 정책을 새로 쓸 때
  이 함수를 쓴다.

### 새 테이블을 만들 때

`SELECT` / `INSERT` / `UPDATE` / `DELETE` 넷을 **한 번에 설계한다.** 하나씩 필요할 때
붙이면 어느 동작이 왜 막혀 있는지 아무도 모르게 된다.

| 명령 | 쓰는 절 | 판단 |
|---|---|---|
| `SELECT` | `using` | 공개인지, 본인 것만인지, 운영자만인지 |
| `INSERT` | `with check` | 소유자 컬럼을 남의 uid로 넣지 못하게 막았는지 |
| `UPDATE` | `using` + `with check` | 아래 참고 |
| `DELETE` | `using` | 진짜 지울 수 있어야 하는지, 상태 컬럼으로 대신할지 |

- **`UPDATE`는 `using`과 `with check`를 항상 같이 검토한다.** `using`은 "어떤 row를 고칠
  수 있나", `with check`는 "고친 결과가 허용되나"로 서로 다른 질문이다. `with check`를
  빠뜨리면 본인 row의 소유자 컬럼을 남에게 넘기거나(`profiles.role` 승격처럼) 권한을
  스스로 올리는 경로가 열린다. 실제 예시는
  `supabase/migrations/20260814000002_profiles_and_submissions.sql`의
  `profiles_update_own`, `submissions_update_own_pending`이다.
- **정책이 없는 명령은 거부된다.** 그래서 `DELETE`를 일부러 열지 않는 것도 정당한 설계지만,
  **의도했다는 사실을 주석으로 남긴다.** 빠뜨린 것과 구분되지 않으면 다음 사람이 추가한다.

### 마이그레이션 체크

**`enable row level security`와 policy SQL은 같은 마이그레이션에 함께 들어간다.** 켜기만 하고
정책을 다음 파일로 미루면 그 사이 배포에서 테이블 전체가 잠기고, 정책만 있고 RLS를 안 켜면
정책이 아무 일도 하지 않은 채 통과한다. 둘 다 조용히 틀린다.

테이블을 추가·변경하는 마이그레이션을 쓴 뒤 확인한다.

```bash
grep -n "enable row level security\|create policy" supabase/migrations/<파일>.sql
./scripts/verify-schema.sh   # 컨테이너에 마이그레이션을 적용하고 anon 권한까지 검사한다
```

정책 요약표는 `docs/db-schema.md`의 "RLS 요약"에 있다. **정책을 바꾸면 그 표도 같이 고친다.**


## 문서 (`docs/`)

읽는 순서와 역할이 다르다.

| 문서 | 역할 |
|---|---|
| `scope.md` | 무엇을 만들고 무엇을 미루는지. **미확정 이슈가 여기 있다** |
| `mvp-decisions.md` | 구속력 있는 제약과 그 근거 |
| `implementation-plan.md` | 폴더 구조와 1차 구현 단계 |
| `research-verification.md` | 위 결정들의 조사 근거 |

### 구속력 있는 결정 (뒤집으려면 문서부터 갱신할 것)

- **크롤링 금지.** 카카오맵 API는 응답 데이터의 별도 저장을 약관으로 금지하며 차단이 실제 집행된다. 카페 데이터는 수기 큐레이션으로만 채운다.
- **권역은 송파·잠실.** 초기 지도 중심은 송리단길(`37.5078, 127.1072`).
- **사진은 Supabase Storage(`place-images` 버킷)에 직접 호스팅한다.** 2026-08-14에 뒤집힌 결정이다 — 원래는 "직접 호스팅하지 않고 `naver_place_url`로 넘긴다"였다. 배경은 `mvp-decisions.md` 3절.
  - ⚠️ **현재 올라간 이미지 9장은 연습용 임시본이며 이용 권리를 확인하지 않았다.** 공개 배포 전에 직접 촬영본이나 사용 허가를 받은 사진으로 교체해야 한다.
  - 카카오맵 API 응답에서 온 URL은 넣지 않는다 (크롤링 금지와 같은 이유).
- **데이터 신선도를 숨기지 않는다.** `last_verified`를 UI에 노출하는 것이 명시적 결정이다.

### 열려 있는 결정

- **`work_policy`(카공 허용: 환영/허용/눈치/금지) 도입 여부** — `scope.md`가 "가장 차별적"이라 규정했으나 현재 보류 상태다. `work_fit`은 대용이 아니다(환경 품질 ≠ 매장 정책). **필터 UI를 붙이기 전에 결정해야 한다.**
- **검증할 핵심 가설** — `scope.md` 미확정 이슈 ③.
- **임시 이미지를 무엇으로 교체할 것인가** — 사진 노출 자체는 결정됐다(위 참고). 남은 것은 출처다. 직접 촬영할지, 매장 동의를 받을지 정하지 않았다. **공개 전에 정해야 한다.**
