# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> `AGENTS.md`는 `next dev`가 실행될 때마다 자동으로 다시 쓰인다. 직접 편집하지 말 것.

## 프로젝트

카공맵 — 노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. **개인 습작 MVP**(인프런 VC 클래스)이며, 사업화가 아니라 학습이 목적이다.

## 명령어

```bash
npm run dev        # 개발 서버 — 포트 3030 고정
npm start          # 프로덕션 실행 — 포트 3030 고정
npm run build      # 프로덕션 빌드 (타입체크가 함께 돌아간다)

npm run verify     # lint → typecheck → test. 커밋 훅이 부르는 것도 이것이다
npm run lint       # eslint — warning도 실패로 친다
npm run typecheck  # next typegen && tsc --noEmit
npm run test       # vitest watch
npm run test:run   # vitest 1회 실행
```

- **포트는 3030이다.** 카카오 콘솔 플랫폼 도메인이 `http://localhost:3030`으로 등록되어 있어, 다른 포트로 띄우면 지도가 뜨지 않는다.
- **타입체크에 `npx tsc --noEmit`을 단독으로 부르지 않는다.** Next.js가 생성하는 전역
  타입(`LayoutProps` 등)을 모르기 때문에 실패한다. `npm run typecheck`가 앞에
  `next typegen`을 붙여 그 타입을 먼저 만든다. 빌드 없이 몇 초에 끝나므로
  타입만 볼 때 `npm run build`를 돌릴 이유가 없다.
- **`npm run lint`는 `--max-warnings=0`이다.** warning을 남겨 두면 exit 0으로 통과해
  아무도 보지 않게 된다.
- **React Compiler 규칙이 두 가지를 error로 막는다** — effect 안에서 `setState`를 부르는
  것(cascading render)과 **렌더 중 ref를 읽는 것**. "렌더에서 만들고 정리해야 하는 값"
  (blob URL 같은)에서 둘 다 막히므로, 우회로를 찾기 전에 `useMemo` + cleanup effect가
  가능한지부터 본다 (`components/submission/PhotoPicker.tsx` 참고).

### pre-commit 훅

**커밋할 때마다 `npm run verify`가 자동으로 돈다**(4~5초). 실패하면 커밋이 멈춘다.

- 훅 본체는 `.githooks/pre-commit`이고 **저장소에 커밋돼 있다.** `.git/hooks/`가 아니라
  여기 두는 이유는 그래야 내용이 리뷰되고 공유되기 때문이다.
- 연결은 `package.json`의 `prepare` 스크립트가 한다 — `git config core.hooksPath .githooks`.
  npm이 `npm install` 뒤에 자동으로 부르므로 따로 설치할 것이 없다. **husky를 쓰지 않는다.**
- **스테이지된 파일만 골라 검사하지 않는다.** typecheck와 test는 파일 단위로 쪼개면
  의미를 잃는다 — 한 파일을 고쳐서 깨지는 곳은 대개 그 파일이 아니다.
- ⚠️ **훅은 작업 트리를 본다. 스테이지 내용이 아니다.** 스테이지하지 않은 변경이 있으면
  방금 통과한 것과 실제로 커밋되는 내용이 다르다. 훅이 그럴 때 한 줄로 알려 준다.
- 일부러 건너뛰려면 `git commit --no-verify`.

### 테스트 (Vitest)

- 테스트 파일은 대상 옆에 둔다 — `lib/openState.ts` ↔ `lib/openState.test.ts`.
- **`Cafe`·`PlaceRow` 더미는 `test/fixtures.ts`의 `makeCafe()` / `makePlaceRow()`를 쓴다.**
  객체를 통째로 새로 적으면 필드가 하나 늘 때마다 모든 테스트를 고쳐야 하고, 그
  테스트가 어떤 값에 관심 있는지가 묻힌다. 관심 있는 필드만 덮어쓴다.
- **`globals: false`다.** `describe`/`it`/`expect`를 `vitest`에서 명시적으로 import한다.
- **`lib/supabase-env.ts`가 import 시점에 throw하는 것을 앱 코드로 풀지 않는다.**
  폴백을 두지 않는 것이 의도된 설계이므로, 더미 값은 `vitest.config.mts`의 `test.env`에
  있다.
- 세션이 필요한 컴포넌트는 **`@/lib/supabase-browser` 하나만 `vi.mock`한다.**
  AuthProvider·BookmarkProvider는 실제 코드가 돌게 둔다 (`components/cafe/CafeCard.test.tsx` 참고).
- 실제 Supabase에 붙는 테스트는 없다. DB 쪽 검증은 `./scripts/verify-schema.sh`가 따로 한다.
- **버그를 잡는 테스트는 수정을 되돌려 실패하는지 확인하고 넣는다.** 통과만 보고 넣으면
  무른 테스트가 남는다.
- **가짜 서버 목은 응답을 호출 시점 스냅샷으로 만든다.** 지연 뒤에 현재 상태를 읽어
  돌려주면 "늦게 도착한 옛 응답"이 재현되지 않아 경합 테스트가 통과해 버린다
  (`components/review/ReviewSection.test.tsx` 참고).
- **`npm run verify`가 초록인 것과 화면이 도는 것은 다르다.** UI를 건드렸으면 아래
  「브라우저 검증」을 따른다.

## 브라우저 검증

**화면을 눈으로 확인할 때는 `playwright-cli`를 쓴다.** `.claude/skills/playwright-cli`에
skill이 깔려 있다.

```bash
playwright-cli open http://localhost:3030   # 브라우저 띄우고 바로 이동
playwright-cli snapshot                     # 요소 ref가 붙은 페이지 스냅샷
playwright-cli find "카카오 로그인"           # 스냅샷에서 텍스트 찾기
playwright-cli click e15                    # ref로 클릭
playwright-cli console                      # 콘솔 로그
playwright-cli close
```

- **`snapshot`이 기본이고 `screenshot`은 예외다.** 스냅샷은 요소 ref가 붙은 텍스트라
  클릭 대상을 좌표로 찍지 않아도 되고 토큰도 훨씬 적게 든다. 스크린샷은 레이아웃이나
  색처럼 **눈으로만 판별되는 것**을 볼 때만 쓴다.
- **빌드가 통과했다는 것과 화면이 도는 것은 다르다.** 이 저장소는 테스트 프레임워크가
  없으므로, UI를 건드렸으면 `npm run build`로 끝내지 말고 실제로 띄워서 확인한다.
- 개발 서버를 먼저 띄워야 한다(`npm run dev`). 서버가 없으면 빈 페이지를 보고
  "고쳤다"고 말하게 된다.
- 지도는 `NEXT_PUBLIC_KAKAO_MAP_KEY`가 있어야 그려진다. 키가 없으면 안내 문구가
  대신 뜨는데 그것은 의도된 폴백이지 깨진 화면이 아니다.
- **로그인이 필요한 화면은 대신 로그인해 주지 않는다.** 카카오 계정 자격증명을
  입력하는 일은 사람이 한다. 에이전트는 로그아웃 상태 흐름까지만 확인하고,
  그 뒤는 확인하지 못했다고 말한다.

## 환경변수

`.env.local`에 셋이 필요하고, 둘은 있으면 좋다.

| 변수 | 없으면 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 대신 안내 문구가 렌더된다 — 의도된 폴백이다 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`가 즉시 throw한다 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같다 |
| `NEXT_PUBLIC_SITE_URL` | `lib/site.ts`가 현재 배포 주소로 떨어진다. 로컬에서는 없어도 된다 |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/prune-orphan-photos.mjs`가 거부한다. **평소에는 없어도 된다** — 승인은 대시보드 SQL로 끝난다. 앱은 이 키를 쓰지 않으므로 **`NEXT_PUBLIC_`을 붙이지 말 것** |

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

### `lib/schema.ts` — JSON-LD 이음매

2026-08-21에 들어왔다. `lib/cafes.ts`와 같은 규칙 — **컴포넌트가 스키마를 직접 조립하지 않는다.**

- `websiteSchema()`는 `/`와 `/cafes` 둘 다에, `cafeListSchema()`는 **`/cafes`에만** 붙는다.
  구조화 데이터는 그 페이지에 실제로 있는 것을 반영해야 하는데, `/`의 카페는 서버 렌더
  콘텐츠가 아니라 지도 위 마커다.
- **`AggregateRating`을 넣지 않는다.** 리뷰 집계는 `useEffect`로 클라이언트에서 붙는 값이라
  SSR된 HTML에 없다. good/bad 두 값이라 `ratingValue` 스케일과도 맞지 않는다.
- 카페별 URL이 없어 `item.url`은 `naver_place_url`을 쓴다. `/cafe/[slug]`가 생기면 바꾼다.
- ⚠️ 사이트 전체가 `noindex`인 동안 이 마크업은 Google 노출로 이어지지 않는다.

### `/cafes` — 지도가 아닌 유일한 화면

지도는 크롤러와 LLM에게 빈 화면이다. `/`가 서버에서 내보내는 본문 텍스트는 **46자**였고
카페 9곳은 전부 클라이언트에서 그려졌다. `/cafes`가 그것을 1222자로 바꾼다.

- **서버 컴포넌트다.** `'use client'`를 붙이는 순간 이 페이지를 만든 이유가 사라진다.
- `/`의 Map Shell은 그대로다. 목록을 dock에 쌓지 않고 별도 라우트로 뺀 이유가 그것이다
  (`DESIGN.md` — Cafe List Page).
- **검색·필터를 두지 않는다.** 그것은 여전히 2차다.
- 카페별 페이지(`/cafe/[slug]`)는 아직 없다. 9곳이라 목록 하나로 충분하고, 개별 페이지는
  카페마다 쓸 글이 생긴 뒤가 순서다. 그게 생기면 sitemap도 그때 의미를 갖는다.

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
- **로그인 여부 판정은 `AuthProvider.requireLogin(reason)` 한 곳에 있다.** 버튼마다 두지
  않는다. 원래 `BookmarkProvider.toggle()`에 있었는데 2026-08-20에 리뷰·제보가 붙으면서
  올렸다. 로그인이 없으면 `loginPrompt`에 이유를 세우고 `MapView`가 모달 하나를 띄운다.
- **북마크 목록에 주인(`userId`)을 같이 들고 렌더 중에 판정한다.** 목록만 들고 로그아웃
  때 비우면 그 일을 effect가 해야 하고, A가 나가고 B가 들어온 순간 B에게 A의 목록이
  잠깐 비친다.
- 저장/해제는 낙관적 갱신이고 실패하면 되돌린다. 하트는 누른 즉시 반응해야 한다.

### 리뷰 · 제보 (UGC 입력)

2026-08-20에 들어왔다. 입력까지만이었고, **검수 화면은 2026-08-21에 `/admin`으로
붙었다**(아래 「관리자 운영 화면」). 대시보드 SQL 경로도 그대로 살아 있다.

- **제보 테이블은 둘이다. 하나가 아니다.**

  | 테이블 | 담는 것 | 필수 |
  |---|---|---|
  | `place_reports` | 새 장소 제보 | `naver_place_url` |
  | `place_edit_requests` | 기존 장소 수정 요청 | `place_id` |

- **`place_reports.place_name`은 선택 입력이다** (2026-08-21 추가).
  네이버 링크에서 상호를 자동으로 뽑을 방법이 없어서 제보자에게 직접 받는다 —
  `naver.me/XXXX`는 `map.naver.com/p/entry/place/<id>`로 307 리다이렉트하는데 그 주소에
  이름이 없고, 최종 페이지는 2.3KB짜리 JS 셸이라 `<title>`도 `og:title`도 비어 있다.
  뽑으려면 헤드리스 브라우저가 필요한데 `map.naver.com/robots.txt`가 봇을 막고,
  무엇보다 **크롤링 금지**가 구속력 있는 결정이다.
  - **필수로 만들지 않는다.** 이름을 몰라도 링크만으로 제보할 수 있어야 한다.
  - **확인된 상호가 아니라 검수의 출발점이다.** 승인 함수가 이 값을 `places`로
    옮기지 않는다 — 관리자 폼이 기본값으로 깔아 주고 최종 판단은 큐레이터가 한다.

  원래 `place_submissions` 하나가 `kind`로 셋을 겸했는데, 필수 항목이 서로 달라 공통
  컬럼이 `payload jsonb` 하나뿐이었다. **가른 이유가 그것이다** — 한 테이블에 두면
  둘 다 nullable이 되고 DB가 아무것도 보장하지 못한다. 2026-08-20에 갈랐고
  `place_submissions`·`approve_submission()`·`submission_kind`는 없앴다.
- **사진 컬럼 이름은 세 테이블 모두 `photos`다.** `places`·`place_reports`·
  `place_edit_requests`가 같은 규칙을 쓴다 — 값은 `place-images` 버킷의 오브젝트
  경로이고, URL이나 공백이 들어오면 check 제약이 막는다.
- **`lib/reviews.ts`·`lib/submissions.ts`가 이음매다.** `lib/cafes.ts`와 같은 규칙이고,
  세션이 필요하므로 둘 다 브라우저 전용이다.
- **slug → uuid 변환은 `lib/place-id.ts` 하나뿐이다.** 북마크·리뷰·제보가 같이 쓴다.
- **리뷰 집계는 `place_review_counts()` RPC로만 읽는다.** `place_reviews`를 직접 select하면
  누가 어디에 `bad`를 눌렀는지가 통째로 나온다. 테이블 select는 본인 행만 열려 있다.
- **승인 함수는 카페를 만들지도 고치지도 않는다.** 두 테이블 어느 쪽도 `places`를 채울
  만큼의 정보를 담지 않기 때문이다(제보는 URL·사진·메모, 수정 요청은 사진·메모).
  큐레이터가 `places`를 직접 만들거나 고친 뒤 함수로 연결·기록만 한다.
  - `approve_place_report(제보id, 카페id, 승인자uuid?)` — 만든 카페에 연결하고 `approved`로.
  - `approve_edit_request(요청id, 승인자uuid?)` — `places.last_verified`를 오늘로 옮긴다.
  - `reject_place_report(id, 사유, 승인자uuid?)` / `reject_edit_request(id, 사유, 승인자uuid?)`
- ⚠️ **service_role로 부를 때는 승인자를 인자로 넘겨야 한다.** service_role 키의 JWT에는
  `sub` 클레임이 없어 `auth.uid()`가 NULL이고, 그러면 `is_curator()`가 false다 — 인자가
  없던 시절 운영 스크립트의 승인은 **한 번도 성공할 수 없었다.** 판정은
  `resolve_reviewer()` 한 곳에 있고 `coalesce(auth.uid(), …)` 순서라, 로그인한
  비큐레이터가 인자로 남을 사칭하는 경로는 열리지 않는다.
- **신규 제보는 그것만으로 카페가 되지 않는다.** 폼이 그 사실을 사용자에게 말한다.
- **관리자 폼이 제보에서 프리필하는 것은 네이버 링크와 가게 이름 둘뿐이다.** 주소·좌표·
  Quick Check는 제보에 없고 사람이 확인해서 채우는 값이다.
- **storage 마이그레이션에서 `alter table ... enable row level security`와 `grant`를 쓰지
  않는다.** 이미 켜져 있고 이미 grant돼 있으며, `alter table`은 소유자만 되므로 깨진다.
  `create policy`와 버킷 insert/upsert는 통과한다.

### 관리자 운영 화면 (`/admin`)

2026-08-21에 들어왔다. 그전까지 제보 승인과 장소 등록은 **Supabase 대시보드 SQL이
유일한 경로**였다. 화면은 둘이다 — `/admin/reports`(검수)와 `/admin/places`(장소 추가·
수정·사진).

- **권한은 `profiles.role in ('curator','admin')` 하나로 판정한다.** 관리자 이메일
  환경변수를 두지 않는다 — 카카오 이메일은 선택 동의라 없을 수 있고, DB의 RLS와 승인
  RPC가 전부 이미 `is_curator()`를 보므로 판정이 둘로 갈리면 "화면은 열렸는데 저장이
  거부되는" 상태가 생긴다. 판정은 `lib/admin/guard.ts` 하나에 있다.
- **큐레이터가 아니면 404다.** 403이 아닌 이유는 이 화면의 존재 자체를 알리지 않기
  위해서다.
- **입구는 dock에 있다.** 큐레이터로 로그인하면 `AuthDock`에 `운영 화면` 버튼이 뜬다
  (`AuthProvider.isCurator`). 그 판정은 **표시용이지 접근 제어가 아니다** — anon 키가
  브라우저에 나가므로 조작할 수 있고, 억지로 들어가도 서버가 404를 낸다.
  `isCurator`는 boolean이 아니라 **주인 uid를 들고 렌더 중에 맞춘다.** boolean으로 들고
  로그아웃 때 effect로 내리면 A가 나가고 B가 들어온 순간 B에게 A의 권한 표시가
  잠깐 비친다 (`BookmarkProvider`가 북마크 목록에 쓰는 것과 같은 방법이다).
- ⚠️ **가드를 레이아웃에만 두면 안 된다.** Next는 레이아웃과 페이지를 **동시에** 렌더하므로,
  레이아웃이 `notFound()`를 던져도 페이지는 이미 자기 몫을 렌더한 뒤이고 **그 RSC
  페이로드가 404 응답에 함께 실린다.** 그래서 **페이지마다 첫 줄에 `guardAdminPage()`**
  를 두고, `lib/admin/*.ts`의 조회 함수도 각자 `requireCurator()`를 부른다.
  (2026-08-21에 실측했다 — 고치기 전 로그아웃 응답 37KB 안에 카페 이름과 주소가 있었다.
  새어 나간 것이 published 카페뿐이었던 것은 조회가 방문자 세션으로 돌아 RLS가 막아 준
  덕이고, 즉 **방어선이 RLS 하나뿐이었다.**)
- ⚠️ **서버 액션은 레이아웃 가드 뒤에 있지 않다.** 별도 POST 엔드포인트로 직접 호출할
  수 있다. **액션마다 `requireCurator()`가 첫 줄이다.**
- **데이터 변경은 전부 서버 액션이고, 사용자 세션(anon 키)으로 돈다.**
  `SUPABASE_SERVICE_ROLE_KEY`를 앱에 들이지 않는다. 대신 큐레이터용 storage 정책을
  마이그레이션으로 열었다(`20260821064124`).

**승인 버튼은 승인하지 않는다.** `approve_place_report()`가 이미 존재하는 카페 id를
인자로 요구하므로 "승인 → 추가 화면" 순서는 성립하지 않는다. 버튼은 장소 폼으로
보내기만 하고(`?report=` / `?request=`), 상태 전환은 폼의 저장 액션이 한다. 중간에
그만두면 제보는 `pending`으로 남고 유령 draft 행도 생기지 않는다.

⚠️ **저장 순서가 고정이다. 바꾸면 사진이 조용히 사라진다** (`app/admin/places/actions.ts`).

1. `places` 쓰기 (`photos`는 건드리지 않는다)
2. 새로 고른 파일 업로드
3. `places.photos`를 최종 배열로 쓰기
4. 빠진 파일 정리
5. **마지막에** 승인 RPC

5가 마지막인 이유는 승인 함수 안의 `attach_submission_photos()`가 제보 사진을
`places.photos`에 **이어 붙이기** 때문이다. 3이 뒤에 오면 방금 붙은 것을 덮어쓴다.
같은 이유로 **제보 사진을 폼에서 복사하지 않는다** — 복사하면 두 번 들어간다.

- **사진을 뺄 때 경로에 따라 다르게 처리한다.** `<slug>/` 아래(관리자가 올린 것)는
  `photos`에서 빼고 storage에서도 지운다. `submissions/` 아래(제보에서 온 것)는
  `photos`에서만 뺀다 — 제보 row가 그 URL을 여전히 가리키고,
  `prune-orphan-photos.mjs`도 제보 row를 참조로 세므로 지우면 검수 이력의 링크만 깨진다.
- **`places_published_requires_core`를 폼이 먼저 막는다.** 제약 이름이 박힌 Postgres
  오류를 화면에 그대로 내보내지 않는다. 판정은 `lib/admin/place-form.ts`에 순수 함수로
  있고 테스트가 붙어 있다.
- **위치는 가게 이름으로 검색해서 고른다** (`LocationPicker`). 운영자가 아는 것은
  주소가 아니라 가게 이름이고, 제보에도 이름 대신 네이버 링크만 온다. 고르면 좌표와
  주소가 함께 채워진다. 지도 클릭은 그 좌표를 미세하게 옮기는 보조 수단으로 남았다.
  - 검색은 **세 번까지** 시도한다 — ① 지도 중심 20km 안에서 키워드로 ② 전국에서
    키워드로 ③ 주소로. ①이 있는 이유는 권역이 송파·잠실이라 전국 정확도순으로 받으면
    같은 이름의 다른 동네 가게가 먼저 오기 때문이다(`나루터 카페`의 1순위는 수원이었다).
    **거르는 것이 아니라 순서를 준다** — 20km면 강남 두 곳도 들어온다.
  - `Places`·`Geocoder` 둘 다 이미 싣고 있는 `libraries=services` 안에 있다.
    **새 지도 라이브러리를 넣지 않는다.**
  - ⚠️ 결과의 **`x`가 경도, `y`가 위도이고 둘 다 문자열이다.** `LatLng`은 (위도, 경도)
    순서에 숫자를 받으므로 그대로 넘기면 지구 반대편이 찍힌다.
- `components/map/KakaoMap.tsx`를 재사용하지 않는다 — 그쪽은 100dvh Map Shell 전용이라
  폼 안에 들어가지 않는다. 지도 인스턴스만 따로 만들고 **스크립트 주소는 공유한다**
  (아래 SDK 절).
- **UI는 Tailwind v4 + shadcn/ui다. `/admin`에서만.** Tailwind CSS는
  `app/admin/admin.css`에서만 import한다 — `app/globals.css`에 넣으면 preflight가 지도
  shell을 무너뜨린다.
  - **예외인 것은 도구뿐이고 기준은 `DESIGN.md` 그대로다.** `admin.css`가 그 문서의
    frontmatter를 Tailwind 유틸리티로 열어 두므로, 화면에서는 `text-section-title` ·
    `rounded-panel` · `shadow-brew`처럼 **이름으로** 부른다. 픽셀 값이나 hex를 직접
    적지 않는다.
  - **간격은 4·8·16·24·32 다섯 칸뿐이다**(`1·2·4·6·8`). `gap-3`(12px)처럼 그 사이 값을
    만들지 않는다.
  - **`Button`·`Badge`에 `destructive` variant가 없다.** 일부러 지웠다 — 남겨 두면
    다음 사람이 "빨간 버튼이 있으니 여기 쓰라는 뜻"으로 읽는다. 색이 드는 것은
    승인(민트)뿐이다.
  - **본문 기준을 공개 화면보다 한 단계 올린다** — 표 본문·입력값은 16px,
    표 머리·라벨·힌트·실패 문구는 14px. 지도 위 UI는 지도를 가리지 않으려고 작지만
    관리자 화면은 오래 들여다보는 문서다. "실패 문구는 회색"은 그대로다.
  - **pill의 좌우 패딩은 반지름보다 커야 한다** — 48px 버튼이면 `px-8`(32px)이다.
    반지름과 같은 값을 주면 글자가 곡선에 붙어 왼쪽으로 쏠려 보인다.
  - **반응형이다.** 그리드는 `grid-cols-1 sm:grid-cols-2` 꼴로 좁은 화면에서 한 줄씩
    내려가고, 표는 `overflow-x-auto`가 받는다.
  - **동작의 결과는 토스트로 말한다**(`sonner`, 레이아웃에 하나). 지금의 **상태**는
    화면에 남긴다 — `작성 중이라 지도에 안 뜬다`는 조건이지 사건이 아니라서 사라지면
    다시 볼 방법이 없다. 갈리는 기준이 그것 하나다.
  - 자세한 매핑표와 이번에 더한 토큰(`text-meta`·`text-caption`), 토스트 규격은
    `DESIGN.md` — 관리자 화면 절에 있다.

⚠️ **`postcss.config.mjs`가 생기기 전에 띄운 dev 서버에는 Tailwind가 돌지 않는다.**
PostCSS 설정은 서버가 뜰 때 한 번만 읽힌다. 관리자 화면을 고쳤는데 브라우저에서
아무것도 바뀌지 않으면 **먼저 `npm run dev`를 다시 띄운다** — 2026-08-21에 이걸로
"디자인이 적용되지 않는다"를 한참 들여다봤다.

### 카페 이미지 (버킷 하나)

**카페와 관련된 이미지는 전부 Supabase Storage의 `place-images` 버킷을 쓴다.**
외부 CDN 이미지를 화면에 얹지 않는다 — 카카오맵 응답 URL 저장 금지(크롤링 금지)와
저작권 확인 결정이 여기 걸려 있다. 유일한 예외는 카카오 avatar이고, 그것은 카페
이미지가 아니라 프로필이다.

- **테이블마다 담는 모양이 다르다. 목적이 다르기 때문이다.**

  | 컬럼 | 값 | 왜 |
  |---|---|---|
  | `places.photos` | 경로 (`naruteo.jpeg`) | 오래 남고 앱이 매번 읽는다. URL을 담으면 프로젝트 ref가 데이터에 박혀 프로젝트를 옮길 때 전부 죽는다 |
  | `place_reports.photos`<br>`place_edit_requests.photos` | **공개 URL** | 검수자가 대시보드에서 값을 그대로 클릭해 열어야 한다. 검수가 끝나면 수명이 끝나는 데이터라 ref가 박히는 대가를 치를 만하다 |

  check 제약이 양쪽을 서로 막는다 — `places`에 URL을 넣거나 제보에 경로를 넣으면 거부된다.
  제보 쪽은 `place-images` 공개 객체 URL 모양까지 강제하므로 외부 CDN 이미지는 들어올 수 없다.
- **URL 조립과 해체는 `lib/place-images.ts` 한 곳뿐이다** (`placeImageUrl` /
  `placeImagePath`). `toCafe()`가 전자를 불러 `Cafe.photos`를 URL로 만들어 주므로
  **컴포넌트는 버킷을 모른다.** `getPublicUrl`은 문자열만 만들고 네트워크를 타지 않아
  서버에서도 안전하다. 승인 스크립트는 후자로 URL에서 경로를 되짚어 파일을 옮긴다.
- **경로가 곧 상태다.**

  | 경로 | 뜻 | 누가 쓰나 |
  |---|---|---|
  | `submissions/<uid>/<uuid>.jpg` | 검수 전 제보 사진 | 본인만 (storage 정책) |
  | `<slug>/<uuid>.jpg` | 승인된 카페 사진 | service_role 스크립트만 |

- ⚠️ **공개 버킷이므로 검수 전 사진도 URL을 안다면 열린다.** 방어선은 셋이다 —
  로그인 사용자는 자기 `submissions/<uid>/` 아래에만 쓸 수 있고, 버킷에 5MB·이미지 3종
  제한이 있고, **폴더당 20장 상한**을 storage 정책이 `submission_photo_count()`로 건다.
  그 함수는 **`places.photos`가 이미 쓰는 사진은 세지 않는다** — 승인된 사진은 검수
  폴더에 남지만 자리를 차지하지 않아야 한다.
  개수 상한이 없으면 `MAX_PHOTOS`가 클라이언트에만 있는 셈이라(anon 키는 브라우저에
  나간다) 공개 버킷이 무한 업로드 대상이 된다.
- **`submission-images`(비공개) 버킷은 폐기됐다.** 2026-08-20 오전에 잠깐 있었다.
  **storage 테이블은 SQL로 지울 수 없으므로**(`storage.protect_delete`가 막는다)
  버킷을 없애는 것은 대시보드나 Storage API로만 된다. 마이그레이션으로 지우려 하지 말 것.
- **승인은 `/admin/reports`에서 하거나, SQL 한 줄로도 된다. 키도 스크립트도 필요 없다.**

  ```sql
  -- 새 장소 제보: 카페를 먼저 만들고(제보에는 이름·주소·좌표가 없다) 연결한다
  select public.approve_place_report('<제보id>', '<카페id>', '<큐레이터uuid>');
  -- 정보 수정 요청: places를 직접 고친 뒤
  select public.approve_edit_request('<요청id>', '<큐레이터uuid>');
  ```

  함수가 **사진까지 붙인다.** 제보의 공개 URL을 경로로 되짚어 `places.photos`에 이어
  붙이고(이미 있으면 건너뛴다), 상태와 확인일을 갱신한다.
- **사진 파일은 옮기지 않는다.** `submissions/<uid>/`에 그대로 두고 `places.photos`가
  그 경로를 가리킨다. 옮기려면 `<slug>/`에 쓸 권한이 필요한데 그것은 사용자에게 열려
  있지 않고, 그 하나 때문에 **승인 전체가 service_role 키에 묶였었다.** 경로가 덜
  깔끔한 대신 승인이 대시보드에서 끝난다.
- **세 번째 인자가 필요한 이유.** 대시보드 SQL 편집기·psql·service_role은 세션이 없어
  `auth.uid()`가 NULL이다. 세션이 있으면 인자는 무시되므로(`coalesce(auth.uid(), …)`)
  로그인한 비큐레이터가 남을 사칭하는 경로는 열리지 않는다.
- **버려진 사진 정리는 두 겹이다.**
  1. **앱이 그 자리에서 되돌린다** — `lib/submissions.ts`의 `removePhotos()`. 사진은
     제출 버튼을 누를 때 올라가고 insert가 그 뒤에 오므로, 중간에 실패하면(중복 제보,
     업로드 도중 실패) 방금 올린 것을 지운다. storage 정책이 `submissions/<본인 uid>/`에
     delete를 열어 두어 **사용자 세션만으로 된다** — 운영자 키가 필요 없다.
     지우기에 실패해도 **던지지 않는다.** 던지면 사용자가 알아야 할 원래 실패를 덮는다.
  2. **놓친 것은 스크립트가 걷어간다** — `scripts/prune-orphan-photos.mjs`. 탭을 닫거나
     네트워크가 끊겨 1번이 못 돈 경우의 안전망이다. **이 스크립트만 `SUPABASE_SERVICE_ROLE_KEY`가
     필요하다**(storage 삭제는 SQL로 못 한다). 쓸 때만 넣고 지우면 된다 —
     **`NEXT_PUBLIC_` 접두사를 붙이지 않는다.**
     참조 목록에 `places.photos`도 포함한다. 승인해도 파일이 검수 폴더에 남으므로,
     빠뜨리면 지도에 이미 뜨는 사진을 지우게 된다.

  ```bash
  node --env-file=.env.local scripts/prune-orphan-photos.mjs        # 목록만
  node --env-file=.env.local scripts/prune-orphan-photos.mjs --yes  # 지운다
  ```

  참조되는 파일은 건드리지 않고, 올라온 지 60분이 안 된 파일도 남긴다(폼이 열려 있을
  수 있다). **storage 테이블은 SQL로 못 지우므로**(`storage.protect_delete`) 이 경로나
  대시보드뿐이다. 참조 목록과 파일 목록은 **끝까지 페이지를 넘겨 읽는다** — 중간에
  잘리면 참조되는 사진을 고아로 오인한다.

### 공유 메타데이터 (링크를 열기 전 화면)

2026-08-21에 들어왔다. 첫 사용자에게 주소를 보내는 것이 이 습작의 유일한 배포 경로라,
링크를 펼쳤을 때 뜨는 카드가 사실상 첫 화면이다.

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

### 폴백 화면 (404 · 에러)

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

### 카카오맵 SDK 통합

명령형 SDK를 React에 붙이는 부분이라 규칙이 몇 가지 있다.

- **`autoload=false`로 로드하고 `kakao.maps.load()` 콜백 안에서 지도를 만든다.** 자동 로드에 맡기면 하이드레이션 시점과 어긋나 `kakao is not defined`가 산발적으로 발생한다.
- ⚠️ **SDK 주소는 `lib/kakao-sdk.ts` 하나에서 나온다. 화면마다 다른 URL을 쓰지 않는다.**
  `window.kakao`는 **문서당 하나뿐인 전역**이라 두 벌이 공존하지 않는다 — 먼저 로드된
  쪽이 이기고, 나중 스크립트는 `window.kakao`가 이미 있으면 조용히 아무 일도 하지 않는다.
  - 2026-08-21에 이걸로 깨졌다. 관리자 폼에만 `libraries=services`를 붙였는데,
    지도(`/`) → dock → 운영 화면 → 제보 승인이 **전부 클라이언트 내비게이션**이라
    `/`가 먼저 불러 둔 services 없는 SDK가 남았다. 결과는
    `Cannot read properties of undefined (reading 'Geocoder')`이고,
    **관리자 주소로 직접 들어가면 재현되지 않아** 더 헷갈렸다.
  - 그래서 **공개 지도도 `libraries=services`를 달고 간다.** 지오코더를 쓰지 않는
    방문자도 함께 받는 것이 대가다. 그 값을 치르는 이유는 대안이 전부 "언제 어느 쪽이
    먼저 로드됐는지"에 기대는 방법이고, 그런 조건은 라우팅 한 줄에 깨지기 때문이다.
  - 그럼에도 **쓰는 쪽에서 `services`의 존재를 확인한다.** 타입에는 항상 있는 것처럼
    보이지만 런타임 보장은 없다. 없으면 주소 검색만 접고 지도는 살린다
    (`LocationPicker`).
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
  `place_reports.submitted_by`, `bookmarks.user_id`. 이름을 가정하지 말고 스키마를 먼저 본다.
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

⚠️ **Supabase MCP `apply_migration`으로 적용했으면 로컬 파일명을 기록된 버전으로 바꾼다.**
MCP는 파일명을 무시하고 자체 타임스탬프로 기록하므로, 그대로 두면 두 가지가 어긋난다.

- `supabase db push`가 이미 적용된 마이그레이션을 다시 적용하려 든다.
- `./scripts/verify-schema.sh`는 **파일명 순서**로 돌기 때문에, 새 파일에 앞선 시각을
  붙이면 아직 없는 테이블을 건드려 깨진다.

```bash
# 적용 뒤 기록된 버전을 확인하고 그 이름으로 바꾼다
select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
mv supabase/migrations/<임시>.sql supabase/migrations/<버전>_<이름>.sql
```

**이미 적용된 마이그레이션의 내용은 고치지 않는다.** 틀렸으면 새 파일로 덮고, 폐기됐으면
내용을 비우되 파일과 버전은 남긴다(`20260820113058_submission_images_bucket.sql`이 그 예다).


## 문서 (`docs/`)

읽는 순서와 역할이 다르다.

| 문서 | 역할 |
|---|---|
| `scope.md` | 무엇을 만들고 무엇을 미루는지. **미확정 이슈가 여기 있다** |
| `mvp-decisions.md` | 구속력 있는 제약과 그 근거 |
| `implementation-plan.md` | 폴더 구조와 1차 구현 단계 |
| `research-verification.md` | 위 결정들의 조사 근거 |
| `seo-audit-2026-08-21/` | SEO 종합 감사 스냅샷. 특정 시점 기록이라 갱신하지 않는다 — 다시 감사하면 새 폴더를 만든다 |

### 구속력 있는 결정 (뒤집으려면 문서부터 갱신할 것)

- **크롤링 금지.** 카카오맵 API는 응답 데이터의 별도 저장을 약관으로 금지하며 차단이 실제 집행된다. 카페 데이터는 수기 큐레이션으로만 채운다.
- **권역은 송파·잠실.** 초기 지도 중심은 송리단길(`37.5078, 127.1072`).
- **사진은 Supabase Storage(`place-images` 버킷)에 직접 호스팅한다.** 2026-08-14에 뒤집힌 결정이다 — 원래는 "직접 호스팅하지 않고 `naver_place_url`로 넘긴다"였다. 배경은 `mvp-decisions.md` 3절.
  - ⚠️ **현재 올라간 이미지 9장은 연습용 임시본이며 이용 권리를 확인하지 않았다.** 공개 배포 전에 직접 촬영본이나 사용 허가를 받은 사진으로 교체해야 한다.
  - 카카오맵 API 응답에서 온 URL은 넣지 않는다 (크롤링 금지와 같은 이유).
- **데이터 신선도를 숨기지 않는다.** `last_verified`를 UI에 노출하는 것이 명시적 결정이다.
- **`work_policy`(카공 허용) 도입.** 2026-08-21에 결정했다(`scope.md` 미확정 이슈 ② 종결).
  컬럼은 처음부터 nullable로 있어서 **마이그레이션 없이** 타입·조회·Quick Check 표시만 붙였다.
  **값은 9곳 전부 null이다** — 매장에 가 봐야 아는 값이라 추측으로 채우지 않는다. 값이 있는
  카페에만 화면에 나온다. `work_fit`은 대용이 아니다(환경 품질 ≠ 매장 정책).

### 열려 있는 결정

- **검증할 핵심 가설** — `scope.md` 미확정 이슈 ③.
- **`work_policy` 9곳의 값을 무엇으로 채울 것인가** — 도입은 결정됐고 컬럼도 비어 있는 채로 있다.
  방문 확인 외에 방법이 없어 `scope.md`의 시드 데이터 수집 병목과 같은 문제다.
- **임시 이미지를 무엇으로 교체할 것인가** — 사진 노출 자체는 결정됐다(위 참고). 남은 것은 출처다. 직접 촬영할지, 매장 동의를 받을지 정하지 않았다. **공개 전에 정해야 한다.**
