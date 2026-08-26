# `lib/` — 이음매

**컴포넌트는 DB·Storage·외부 SDK를 직접 건드리지 않는다.** 전부 이 폴더를 통한다.
JSON에서 Supabase로 갈아탈 때 컴포넌트가 한 줄도 바뀌지 않은 이유가 그것이다.
**이 규칙을 깨면 이 구조의 의미가 사라진다.**

각 파일은 머리 주석에 자기 결정과 근거를 갖고 있다. **고치기 전에 그 파일을 연다.**
여기 적는 것은 **한 파일만 봐서는 보이지 않는 것**뿐이다.

## 무엇의 원본인가

| 파일 | 원본인 것 | 어디서 쓰나 |
|---|---|---|
| `cafes.ts` | places row → `Cafe` 변환(`toCafe`), 공개 카페 조회 | 서버 |
| `place-id.ts` | slug → `places.id`(uuid) | 브라우저 |
| `place-images.ts` | 버킷 경로 ↔ 공개 URL | 양쪽 |
| `photo-rules.ts` | 사진 **한 파일** 판정(용량·MIME) | 양쪽 |
| `schema.ts` | JSON-LD 조립 | 서버 |
| `site.ts` | 사이트 절대 주소 | 서버 |
| `log.ts` | 구조화 로그 | 서버 |
| `openState.ts` | "지금 영업중" 판정 | 양쪽 |
| `bookmarks.ts` · `reviews.ts` · `submissions.ts` | 사용자 쓰기 | **브라우저 전용** |
| `admin/guard.ts` | 관리자 판정 | **서버 전용** |

## 같은 것을 두 번 만들지 않는다

- **places row → `Cafe` 변환은 `toCafe()` 하나뿐이다.** 북마크 조회도 `PLACE_COLUMNS`와
  `toCafe`를 빌려 쓴다. 두 번째 변환 코드를 만들면 두 경로가 반드시 어긋난다.
- **slug → uuid 변환은 `place-id.ts` 하나뿐이다.** 북마크·리뷰·제보가 같이 쓴다.
- **URL 조립과 해체는 `place-images.ts` 하나뿐이다.** `toCafe()`가 그것을 불러
  `Cafe.photos`를 URL로 만들어 주므로 **컴포넌트는 버킷을 모른다.**
- **사진 파일 판정은 `photo-rules.ts` 하나뿐이다.** `submissions.ts`에서 갈라 나왔다 —
  그쪽은 브라우저 전용이라 관리자 서버 액션이 import할 수 없다. **개수 상한은 여기
  없다.** 그건 파일의 성질이 아니라 폼마다 다른 정책이다(제보 5장, 관리자 무제한).

## 서버·브라우저 경계

같은 이유로 갈라진 파일이 셋이다. 합치면 빌드가 깨진다.

| 브라우저가 못 쓰는 것 | 갈라 나온 것 | 이유 |
|---|---|---|
| `admin/reports.ts` | `admin/submission.ts` | 전자가 `next/headers`에 닿는다. 표·dialog는 라벨만 필요하다 |
| `submissions.ts` | `photo-rules.ts` | 전자가 세션 클라이언트를 쓴다 |
| `bookmarks.ts` | — | 서버에서 부르면 세션이 없어 빈 목록이 돌아온다 |

가르는 기준은 하나다 — **브라우저가 알아도 되는가.**

## Supabase 클라이언트가 셋인 이유

| 파일 | 쓰는 곳 | 세션 |
|---|---|---|
| `supabase.ts` | `cafes.ts` — 공개 카페 조회 | 없음 (`persistSession: false`) |
| `supabase-browser.ts` | 클라이언트 컴포넌트 | 쿠키 |
| `supabase-server.ts` | route handler, 서버 액션 | 쿠키 |

- **공개 조회에 세션 클라이언트를 쓰지 않는다.** 쿠키를 읽는 순간 `app/page.tsx`의
  `revalidate = 300`이 죽고 요청마다 동적 렌더가 된다. 카페 목록은 로그인과 무관하다.
- 환경변수 검사는 `supabase-env.ts` 하나뿐이다. 셋이 같은 검사를 따로 하지 않는다.
- `select('*')`를 쓰지 않는다. `PLACE_COLUMNS`는 **한 줄 리터럴이어야** supabase-js가
  결과 타입을 추론한다.

## 인증

- **PKCE라 콜백 교환을 서버에서 한다** (`app/auth/callback/route.ts`). code verifier가
  쿠키에 있다.
- **세션 갱신 파일은 `middleware.ts`가 아니라 `proxy.ts`다.** Next 16에서 이름이 바뀌었다.
  Supabase 공식 문서의 `middleware.ts` 예제를 그대로 옮기면 파일이 조용히 무시된다.
- **사용자 이름·avatar는 `user_metadata`에서 읽는다**(`profiles` 테이블이 아니라).
  카카오가 주는 키가 동의항목에 따라 갈리므로 `name`/`full_name`/… 순서로 훑는다.
  **이메일은 선택 동의라 없을 수 있다** — 없으면 줄을 뺀다.

콘솔 설정 두 가지가 맞아야 로그인이 돌아간다.

- Supabase → Authentication → URL Configuration의 Redirect URLs에 `http://localhost:3030/**`
- 카카오 개발자 콘솔 Redirect URI에 `https://<project-ref>.supabase.co/auth/v1/callback`

## 판정을 두 곳에 두지 않는다

- **로그인 여부 판정은 `AuthProvider.requireLogin(reason)` 한 곳에 있다.** 버튼마다 두지
  않는다. 로그인이 없으면 `loginPrompt`에 이유를 세우고 `MapView`가 모달 하나를 띄운다.
- **관리자 판정은 `admin/guard.ts` 하나에 있다.** `AuthProvider.isCurator`는 **표시용이지
  접근 제어가 아니다** — anon 키가 브라우저에 나가므로 조작할 수 있다.
- **저장/해제는 낙관적 갱신이고 실패하면 되돌린다.** 하트는 누른 즉시 반응해야 한다.
- **주인이 바뀌는 상태는 boolean으로 들지 않는다.** 북마크 목록과 `isCurator` 둘 다
  **주인 uid를 같이 들고 렌더 중에 맞춘다.** boolean으로 들고 로그아웃 때 effect로
  내리면 A가 나가고 B가 들어온 순간 B에게 A의 것이 잠깐 비친다.

## `openState.ts` — 자정을 넘기는 영업

`close_time <= open_time`이면 자정을 넘기는 영업으로 보고 구간을 나눠 OR로 판정한다.
시드에 `12:00~00:00`(나루터)이 실제로 존재하므로 **이 경로는 죽은 코드가 아니다.**
`now`를 주입할 수 있게 열려 있다.

## 더 볼 것

- 사진 경로 규칙과 버킷 — `docs/images.md`
- 리뷰·제보 테이블 구조와 승인 함수 — `docs/ugc.md`
- JSON-LD를 어디에 붙이고 어디에 안 붙이는지 — `docs/seo.md`
