# PRD: 관리자 운영 화면 (`/admin/reports` · `/admin/places`)

> 입력: 2026-08-21 `/clarify` 핸드오프. 결정 다섯 개는 아래 「Pre-Work」와
> 「Risks And Open Decisions」에 그대로 옮겼다.

## Summary

사용자 제보를 받는 입구는 2026-08-20에 열렸다(`place_reports`,
`place_edit_requests`). **그런데 그것을 처리할 화면이 없다.** 승인·반려는 Supabase
대시보드 SQL 편집기에서 uuid를 손으로 붙여 넣는 것이 유일한 경로고, 카페를 새로
등록하거나 사진을 바꾸는 일도 대시보드와 `psql`로만 된다. 제보가 들어와도 지도에
반영될 실질적 통로가 없다는 뜻이다.

화면 둘을 만든다.

1. **`/admin/reports`** — 신규 제보와 수정 요청을 표로 읽고, 상세를 dialog로 열고,
   승인하거나 반려한다.
2. **`/admin/places`** — 지도에 뜨는 `places` 목록을 보고, 카페를 추가하고 고치고,
   사진을 직접 올리고 바꾸고 지운다.

둘은 승인 흐름으로 이어진다. 신규 제보 승인은 장소 추가 화면으로, 수정 요청 승인은
그 장소의 수정 화면으로 넘어가고, **저장하는 순간 제보의 상태 전환까지 함께
확정된다.**

데이터 변경은 전부 Next.js Server Action에서 일어난다. 클라이언트가 Supabase를 직접
부르지 않는다. Server Action은 **사용자 세션(anon 키 + RLS)** 으로 돌고,
`SUPABASE_SERVICE_ROLE_KEY`를 앱에 들이지 않는다.

## Problem And Goal

### Problem

- 제보를 처리하려면 대시보드에서 `select public.approve_place_report('<uuid>', '<uuid>', '<uuid>')`를
  손으로 친다. uuid 세 개를 눈으로 옮겨 적는 작업이라 실수하면 조용히 엉뚱한 카페에 붙는다.
- 제보 사진은 `photos` 컬럼의 URL 배열이다. 대시보드에서 한 장씩 클릭해 새 탭으로 연다.
- 새 카페 등록은 `insert into public.places (...)`를 손으로 쓰는 일이다. 컬럼이 19개고
  `places_published_requires_core` 제약이 있어 한 번에 통과하는 일이 드물다.
- 좌표(`lat`/`lng`)는 카카오맵을 따로 띄워 숫자를 복사해 온다.
- 사진 교체는 Storage 대시보드 업로드 → 경로 복사 → `places.photos` 배열 편집의 3단계다.

### Goal

**제보 하나를 지도 위 카페로 바꾸는 일이 브라우저 한 탭 안에서 끝난다.** uuid를 손으로
옮기지 않고, 좌표를 복사해 오지 않고, SQL을 쓰지 않는다.

## Users And Use Cases

**사용자는 큐레이터 한 명(저장소 소유자)이다.** 다중 운영자·역할 분리·초대 흐름은
고려하지 않는다. `profiles.role='curator'`인 계정은 현재 하나
(`20260820113105_promote_curator.sql`).

| # | Use case | 흐름 |
|---|---|---|
| UC1 | 새 카페 제보를 지도에 올린다 | `/admin/reports` → 제보 dialog에서 네이버 링크를 열어 확인 → `승인하고 장소 만들기` → 폼에서 이름·주소·좌표·Quick Check 입력 → 저장 → 제보가 `approved`가 되고 카페가 생긴다 |
| UC2 | 쓸모없는 제보를 정리한다 | 제보 dialog → `반려` → 사유 입력 → `rejected` |
| UC3 | 수정 요청을 반영한다 | `/admin/reports` 수정 요청 탭 → dialog에서 사진·메모 확인 → `승인하고 장소 수정` → 폼에서 값을 고치고 저장 → 요청이 `approved`가 되고 확인일이 오늘로 옮겨간다 |
| UC4 | 제보와 무관하게 카페를 추가한다 | `/admin/places` → `장소 추가` → 저장 |
| UC5 | 임시 사진을 교체한다 | `/admin/places` → 카페 수정 → 사진 슬롯의 `바꾸기` → 저장 |
| UC6 | 카페를 지도에서 내린다 | 카페 수정 → `status`를 `hidden`이나 `closed`로 |

## Pre-Work

착수 전에 확정된 것들이다. 구현 중에 뒤집으려면 이 문서를 먼저 고친다.

**P1. Tailwind v4 + shadcn/ui를 도입하되 `/admin`에서만 쓴다.**
이 저장소에는 Tailwind가 없다. 공개 화면은 전부 `app/globals.css`의 CSS 변수 토큰으로
만들어져 있고 `DESIGN.md`가 그 기준이다. 표·dialog·form이 많은 관리자 화면에서
shadcn이 실제로 시간을 줄여 주므로 넣되, **공개 화면(`/`, `/cafes`, 지도·dock·상세·모달)은
한 줄도 건드리지 않는다.** shadcn 테마 변수는 `DESIGN.md` 토큰에 매핑해 색 팔레트는
하나로 유지한다. `DESIGN.md`에 "관리자 화면은 이 기준의 예외"를 명시하는 것이 이
결정의 조건이다 — 코드만 앞서가면 기준이 죽는다(`CLAUDE.md` 디자인 절).

**P2. 권한은 `profiles.role in ('curator','admin')` 하나로 판정한다.**
관리자 이메일 환경변수를 두지 않는다. 이유 둘 — (a) 카카오 이메일은 선택 동의라
세션에 없을 수 있다(`CLAUDE.md` 인증 절), (b) DB의 RLS 정책과 승인 RPC가 전부 이미
`public.is_curator()`에 걸려 있어, 앱이 다른 기준으로 판정하면 화면은 통과했는데 RLS가
거부하는 상태가 생긴다.

**P3. Server Action은 사용자 세션(`lib/supabase-server.ts`, anon 키 + RLS)으로 돈다.**
`SUPABASE_SERVICE_ROLE_KEY`를 앱에 들이지 않는다 — 직전 커밋 `3f7596e`가 승인 경로에서
그 키를 걷어낸 방향과 같다. 대신 마이그레이션을 하나 추가해, `is_curator()`면
`place-images` 버킷 전체에 insert/update/delete를 여는 storage 정책을 붙인다.

**P4. 승인은 장소를 저장하는 순간 함께 확정된다.**
`approve_place_report(제보id, 카페id, 승인자?)`는 **이미 만들어진 카페의 id를 인자로
요구한다.** 그래서 "승인 → 추가 화면" 순서는 그대로 성립하지 않는다. 승인 버튼은
장소 폼으로 **보내기만** 하고, 폼의 저장 Server Action이 `places` 쓰기와 승인 RPC를
이어서 부른다. 중간에 그만두면 제보는 `pending`으로 남고 유령 draft 행도 생기지 않는다.

**P5. 좌표는 폼 안 카카오맵을 클릭해서 찍는다.**
SDK를 `libraries=services`로 다시 불러 주소 검색과 역지오코딩을 붙이고,
`types/kakao.d.ts`에 `Geocoder` 선언을 추가한다. 현재 `KakaoMap.tsx`의 SDK URL에는
`libraries` 파라미터가 없다.

## Non-Goals

- **공개 화면의 Tailwind 이전.** `/`, `/cafes`와 그 하위 컴포넌트는 그대로 둔다.
- **검색·필터.** `/admin/places` 목록에 이름 검색조차 넣지 않는다. 카페가 9곳이다.
  (`scope.md`가 공개 화면의 검색을 2차로 미뤄 둔 것과 같은 판단)
- **다중 운영자, 초대, 역할 관리 화면.** 승격은 지금처럼 마이그레이션으로 한다.
- **감사 로그.** `reviewed_by`/`reviewed_at`/`updated_at` 이상으로 남기지 않는다.
- **장소 삭제.** `places`에 DELETE 정책이 없고, 그것은 의도된 설계다.
  `status`를 `hidden`/`closed`로 바꾸는 것이 대신이다.
- **사진 순서 변경(드래그 정렬).** 추가·교체·삭제만 한다.
- **폐업 신고 접수.** `place_closure_reports` 테이블은 여전히 없다.
- **`work_policy` 9곳 값 채우기.** 방문 확인이 필요한 별개 문제(`scope.md`).
- **모바일 최적화.** 관리자 화면은 데스크톱 폭을 전제로 한다.
- **`/admin` 진입점을 공개 화면에 노출하는 것.** 주소를 직접 친다.

## Requirements

### 접근 제어

**R1.** `/admin` 이하 모든 라우트는 (a) 로그인 세션이 있고 (b)
`profiles.role in ('curator','admin')`인 사용자에게만 열린다. 그 밖의 모든 경우
— 로그아웃, 일반 사용자, 존재하지 않는 프로필 — 에는 **404를 낸다.** 401·403이 아니라
404인 이유는 관리자 화면의 존재 자체를 노출하지 않기 위해서다.

**R2.** **모든 Server Action은 스스로 큐레이터 판정을 한 번 더 한다.** Server Action은
레이아웃을 거치지 않는 별도 엔드포인트로 호출되므로, `app/admin/layout.tsx`의 가드가
액션을 보호하지 않는다. 판정 코드는 공통 함수 하나(`requireCurator()`)에 두고 액션마다
첫 줄에서 부른다. 판정에 실패하면 액션은 에러를 던진다.

**R3.** 공개 화면(dock·상세·`/cafes`)에 `/admin` 링크를 노출하지 않는다. 큐레이터에게도
노출하지 않는다.

### `/admin/reports`

**R4.** 한 페이지 안 탭 두 개로 **신규 제보**(`place_reports`)와 **수정 요청**
(`place_edit_requests`)을 나눠 보여준다. 각 표의 컬럼은 다음과 같다.

| 탭 | 컬럼 |
|---|---|
| 신규 제보 | 상태 · 네이버 링크(도메인만 표시) · 사진 수 · 메모 앞부분 · 제보자 · 생성 시각 |
| 수정 요청 | 상태 · 대상 카페 이름 · 사진 수 · 메모 앞부분 · 제보자 · 생성 시각 |

**R5.** 상태 필터가 있다. 기본값은 `대기`(`pending`)이고 `승인`·`반려`·`전체`를 고를 수
있다. 필터는 URL 쿼리 파라미터로 표현돼 새로고침해도 유지된다.

**R6.** 표의 행을 누르면 dialog가 열리고 다음을 보여준다 — **사진 썸네일**(누르면 원본을
새 탭에서 연다), **메모 전문**, **네이버 URL**(신규 제보) 또는 **대상 카페 이름과 링크**
(수정 요청), **제보자**, **생성 시각**. 이미 처리된 건이면 처리 결과(상태·검수 시각·반려
사유)도 함께 보여준다.

**R7.** dialog에서 `반려`를 누르면 사유를 입력받아 `reject_place_report(id, 사유)` 또는
`reject_edit_request(id, 사유)`를 부른다. 성공하면 dialog가 닫히고 표가 갱신된다.
**사유는 필수가 아니다** — RPC의 두 번째 인자가 nullable이다.

**R8.** dialog의 `승인` 버튼은 RPC를 부르지 않는다. 장소 폼으로 이동만 한다.

| 탭 | 이동 경로 |
|---|---|
| 신규 제보 | `/admin/places/new?report=<report-id>` |
| 수정 요청 | `/admin/places/<place-id>/edit?request=<request-id>` |

이미 `pending`이 아닌 건에는 승인·반려 버튼을 그리지 않는다.

### `/admin/places`

**R9.** `places` 전체를 표로 보여준다. **`status`와 무관하게 전부 보인다** —
`draft`·`hidden`·`closed`도 여기서는 보여야 한다(큐레이터 RLS 정책이 이미 허용한다).
컬럼: 대표 사진 썸네일 · 이름 · 주소 · `status` · `work_fit` · 확인일(`last_verified`) ·
사진 수. 정렬은 `updated_at` 내림차순.

**R10.** 추가(`/admin/places/new`)와 수정(`/admin/places/<id>/edit`)은 **같은 폼
컴포넌트**를 쓴다. 다루는 필드는 다음 전부다.

| 그룹 | 필드 |
|---|---|
| 식별 | `slug`, `name`, `address`, `district`, `naver_place_url` |
| 위치 | `lat`, `lng` (지도 클릭) |
| 영업 | `is_24h`, `open_time`, `close_time`, `iced_americano_price` |
| Quick Check | `outlet`, `wifi`, `noise`, `work_fit`, `work_policy` |
| 운영 | `status`, `tags`, `last_verified` |
| 사진 | `photos` |

`work_policy`는 비워 둘 수 있어야 한다. **9곳이 전부 null인 것이 정상이고 추측으로
채우지 않는다**(`CLAUDE.md` 데이터 절).

**R11.** 좌표는 폼 안 카카오맵에서 클릭해 찍는다. 주소를 입력하고 `주소로 찾기`를
누르면 지도가 그 위치로 이동하고 좌표가 채워진다. 지도를 클릭하면 그 지점의 좌표가
잡히고, 역지오코딩으로 얻은 주소를 `주소 채우기` 버튼으로 주소 칸에 넣을 수 있다.
`NEXT_PUBLIC_KAKAO_MAP_KEY`가 없으면 **지도 대신 안내 문구와 숫자 입력 두 칸으로
떨어진다** — 키 없이도 폼이 막히지 않아야 한다.

**R12.** 사진은 세 가지를 할 수 있다.

- **추가** — 파일을 골라 올린다. 검증은 기존 `checkPhotos()`와 같은 규칙
  (JPG/PNG/WebP, 한 장 5MB 이하)을 쓴다.
- **교체** — 슬롯의 `바꾸기`를 누르면 그 자리의 사진이 새 파일로 대체된다.
  **배열 안 위치가 유지된다**(첫 장이 마커 썸네일이므로 순서가 의미를 갖는다).
- **삭제** — 슬롯의 `빼기`를 누르면 `places.photos`에서 빠진다.

**R13.** 삭제·교체로 `places.photos`에서 빠지는 경로는 **어디에 있느냐에 따라 다르게
처리한다.**

| 경로 | 처리 | 이유 |
|---|---|---|
| `<slug>/…` 또는 `<place-id>/…` | `photos`에서 빼고 **storage 오브젝트도 지운다** | 관리자가 올린 파일이라 다른 데서 참조하지 않는다 |
| `submissions/…` | `photos`에서만 뺀다. **파일은 남긴다** | 제보 row가 여전히 그 URL을 가리킨다. 지우면 검수 이력의 사진 링크가 깨지고, `prune-orphan-photos.mjs`도 제보 row를 참조로 세므로 어차피 걷어가지 않는다 |

storage 삭제에 실패해도 **던지지 않는다.** 경고만 남기고 저장은 성공시킨다 —
`lib/submissions.ts`의 `removePhotos()`와 같은 규칙이다.

**R14.** `status`를 `published`로 두려면 `outlet`·`wifi`·`noise`·`work_fit`·`last_verified`가
모두 채워져 있어야 한다(`places_published_requires_core`). **폼이 저장 전에 이것을
검사하고 무엇이 비었는지 한국어로 알려준다.** Postgres 제약 위반 메시지를 그대로
노출하지 않는다.

**R15.** 저장은 Server Action이 한다. 성공하면 `/admin/places`로 돌아가고, 공개 화면의
카페 목록 캐시를 무효화한다(`app/page.tsx`의 `revalidate = 300`이 걸려 있으므로
`revalidatePath('/')`와 `revalidatePath('/cafes')`).

**R16.** 사진 파일의 저장 경로는 `<slug>/<uuid>.<ext>`다. 저장 시점에 `slug`가 비어 있으면
`<place-id>/<uuid>.<ext>`를 쓴다. `places.photos`에는 **경로**를 넣는다. URL을 넣으면
check 제약이 거부한다.

### 승인 연결

**R17.** 장소 폼이 `?report=<id>`를 받으면 해당 제보를 읽어 **네이버 URL을 프리필**하고,
제보의 사진·메모를 폼 위쪽에 **읽기 전용 참고 영역**으로 보여준다.
`?request=<id>`를 받으면 요청의 사진·메모를 같은 자리에 보여준다.

**R18.** **제보 사진을 폼의 `photos`에 복사하지 않는다.** 승인 RPC 안의
`attach_submission_photos()`가 제보의 공개 URL을 경로로 되짚어 `places.photos`에 이어
붙인다. 폼이 또 넣으면 같은 사진이 두 번 들어간다.

**R19.** 승인 경로의 저장 순서는 다음으로 **고정한다.** 순서가 틀리면 사진이 사라진다.

1. `places` insert(신규) 또는 update(수정)
2. 관리자가 새로 고른 파일을 storage에 업로드
3. `places.photos`를 최종 배열로 update
4. **마지막에** `approve_place_report(제보id, 카페id)` 또는 `approve_edit_request(요청id)`

승인 RPC가 `photos`에 **이어 붙이는** 동작이므로 3번보다 뒤에 와야 한다. 3번이 뒤에
오면 방금 붙은 제보 사진을 덮어쓴다.

**R20.** `approve_edit_request()`는 `places.last_verified`를 **오늘로 덮는다.** 수정 요청
승인 경로에서는 확인일 필드 옆에 그 사실을 한 줄로 안내한다.

**R21.** 승인 RPC가 `이미 처리된 제보입니다` 등으로 실패하면, **`places` 쓰기는 이미
끝난 상태다.** 이때 장소 저장은 성공했고 제보 연결만 실패했다는 것을 화면에서 구분해
알린다. 장소를 되돌리지 않는다.

**R22.** `?report=`/`?request=`가 가리키는 건이 이미 `pending`이 아니면, 폼 진입 시점에
안내를 띄우고 **승인 없이 일반 저장으로만** 진행한다.

### 스키마 · 정책 · 문서

**R23.** 마이그레이션을 하나 추가해 `storage.objects`에 큐레이터 정책 셋
(insert/update/delete)을 만든다. 조건은 `bucket_id = 'place-images'`와
`public.is_curator((select auth.uid()))`다. **`alter table … enable row level security`와
`grant`를 쓰지 않는다** — 이미 켜져 있고 이미 grant돼 있으며 `alter table`은 소유자만
된다(`CLAUDE.md`).

**R24.** `supabase/tests/20_rls_checks.sql`에 케이스를 추가한다 — 큐레이터는
`<slug>/` 경로에 insert·delete할 수 있고, 일반 사용자는 여전히 못 한다.

**R25.** 문서를 같은 작업에서 갱신한다.

| 문서 | 갱신 내용 |
|---|---|
| `docs/db-schema.md` | RLS 요약표에 새 storage 정책 셋 |
| `CLAUDE.md` | 관리자 화면 절 추가 — 라우트, 권한 판정, Server Action 규칙, 승인 저장 순서 |
| `DESIGN.md` | "관리자 화면은 Tailwind + shadcn을 쓰는 예외" 명시 |
| `docs/scope.md` | 검수 화면이 없다는 서술을 갱신 |

### UI 스택

**R26.** Tailwind v4와 shadcn/ui를 설치한다. Tailwind의 스캔 대상은 `app/admin/**`와
`components/admin/**`로 제한하고, shadcn 컴포넌트는 `components/ui/`에 둔다.
shadcn 테마 변수(`--background`, `--foreground`, `--primary`, …)는 `DESIGN.md` 토큰에
매핑한다. **다크 모드 분기를 만들지 않는다**(`DESIGN.md` — 팔레트가 라이트 하나뿐이다).

**R27.** 공개 화면에 시각적 회귀가 없다. Tailwind의 preflight(전역 리셋)가
`app/globals.css`와 충돌해 지도·dock·상세를 무너뜨리지 않아야 한다.

## Acceptance Criteria

**AC1.** 로그아웃 상태로 `/admin`, `/admin/reports`, `/admin/places`,
`/admin/places/new`에 접근하면 넷 다 404가 뜬다. (playwright-cli)

**AC2.** `profiles.role='user'`인 계정 세션으로도 같은 네 경로가 404다.
(SQL로 임시 계정을 만들어 확인하거나, 큐레이터 계정의 role을 잠시 내려 확인)

**AC3.** 큐레이터 세션이 아닌 상태에서 장소 저장 Server Action을 직접 호출하면
(예: 폼을 연 뒤 다른 탭에서 role을 내리고 저장) 에러로 거부되고 `places`에 행이
생기거나 바뀌지 않는다. (`select count(*) from public.places` 비교)

**AC4.** `/admin/reports`가 대기 중 신규 제보와 수정 요청을 각각 탭으로 보여주고,
표의 행 수가 `select count(*) … where status='pending'`과 일치한다.

**AC5.** 상태 필터를 `승인`으로 바꾸면 URL에 쿼리 파라미터가 반영되고, 새로고침해도
같은 목록이 유지된다.

**AC6.** 제보 행을 누르면 dialog가 열리고 사진 썸네일·메모·네이버 URL·제보자·생성
시각이 전부 보인다. 썸네일을 누르면 원본이 새 탭에서 열린다.

**AC7.** 대기 중 제보를 반려하면 `place_reports.status='rejected'`,
`review_note='<입력한 사유>'`, `reviewed_by='<큐레이터 uuid>'`, `reviewed_at`이
채워진다. (SQL 확인)

**AC8.** 신규 제보 dialog의 `승인하고 장소 만들기`를 누르면
`/admin/places/new?report=<id>`로 이동하고, **그 시점에 제보는 여전히 `pending`이다.**
(SQL 확인)

**AC9.** 그 폼에서 이름·주소·좌표·Quick Check를 채우고 저장하면 한 번의 저장으로
다음이 모두 성립한다. (SQL 확인)
- `places`에 새 행이 생겼다.
- `place_reports.status='approved'`이고 `place_id`가 그 행을 가리킨다.
- `places.photos`에 **제보 사진이 들어 있고 중복이 없다.**

**AC10.** 수정 요청 승인 경로로 저장하면 `place_edit_requests.status='approved'`이고
`places.last_verified = current_date`다. (SQL 확인)

**AC11.** `/admin/places` 목록에 `status='draft'`인 카페도 보인다. (draft 행을 하나 만들어 확인)

**AC12.** 장소 폼에서 지도를 클릭하면 `lat`/`lng` 값이 그 지점으로 바뀌고, 저장 후
`places` 행의 좌표가 화면에 표시됐던 값과 같다. (SQL 확인)

**AC13.** `NEXT_PUBLIC_KAKAO_MAP_KEY`를 비우고 폼을 열면 지도 대신 안내 문구와 숫자
입력 두 칸이 나오고, 그 칸으로 좌표를 넣어 저장할 수 있다.

**AC14.** 핵심 다섯(`outlet`·`wifi`·`noise`·`work_fit`·`last_verified`) 중 하나를 비운
채 `status='published'`로 저장을 누르면, 저장이 막히고 **무엇이 비었는지 한국어로**
표시된다. Postgres 제약 이름(`places_published_requires_core`)이 화면에 나오지 않는다.

**AC15.** 수정 폼에서 사진을 올리면 `places.photos`에 **경로**(`naruteo/<uuid>.jpg` 꼴)가
들어가고 URL이 아니다. 그 카페의 상세 패널과 마커에 새 사진이 보인다. (SQL + 브라우저)

**AC16.** `<slug>/` 아래 사진을 빼면 `places.photos`에서 사라지고 storage 오브젝트도
없다. `submissions/` 아래 사진을 빼면 `places.photos`에서만 사라지고 **파일은 남아
있다.** (`select … from storage.objects` 확인)

**AC17.** `./scripts/verify-schema.sh`가 새 storage 정책 케이스를 포함해 통과한다.

**AC18.** `npm run verify`가 통과한다 (lint `--max-warnings=0` 포함).

**AC19.** `npm run build`가 통과하고, `/`와 `/cafes`가 여전히 정적/ISR로 빌드된다.
빌드 출력에서 두 라우트가 동적(`ƒ`)으로 바뀌지 않았다.

**AC20.** 공개 화면 시각 확인 — `/`의 지도·dock·마커·상세 패널과 `/cafes`가 이번 작업
전과 같다. (스크린샷 비교)

## Verification - Agent

에이전트가 직접 돌려 증거를 남길 것들이다.

```bash
npm run verify                 # lint → typecheck → test (AC18)
npm run build                  # 라우트 렌더 방식 확인 (AC19)
./scripts/verify-schema.sh     # 마이그레이션 + RLS + 새 storage 정책 (AC17)
```

```bash
# 개발 서버를 띄우고 로그아웃 상태 흐름 (AC1)
npm run dev
playwright-cli open http://localhost:3030/admin/reports
playwright-cli snapshot        # 404 화면인지
playwright-cli console         # 에러가 없는지
```

DB 확인은 Supabase MCP `execute_sql`로 한다.

```sql
-- AC4
select status, count(*) from public.place_reports group by status;
-- AC9
select r.status, r.place_id, p.name, p.photos
  from public.place_reports r left join public.places p on p.id = r.place_id
 where r.id = '<report-id>';
-- AC16
select name from storage.objects
 where bucket_id = 'place-images' and name like 'submissions/%';
```

**단위 테스트로 덮을 것** (Vitest, 대상 파일 옆에 둔다):

- `places` 폼 값 → DB 페이로드 변환. 빈 문자열이 `null`이 되는지, `is_24h=true`일 때
  영업시간이 어떻게 되는지, `tags` 문자열 파싱.
- `published` 사전 검증 — 비어 있는 필드 목록을 정확히 돌려주는지 (AC14).
- 사진 경로 판별 — `submissions/` 접두사인지 아닌지 (R13, AC16).
- 최종 `photos` 배열 계산 — 교체가 위치를 유지하는지 (R12).

**목은 `@/lib/supabase-server`만 건다.** `test/fixtures.ts`의 `makeCafe()`/`makePlaceRow()`를
쓰고, 새 더미가 필요하면 거기에 `makePlaceReport()`를 추가한다.

## Verification - Human

에이전트가 대신할 수 없는 것들이다. **카카오 로그인 자격증명은 사람이 넣는다**
(`CLAUDE.md` 브라우저 검증).

- [ ] 큐레이터 계정으로 로그인해 `/admin/reports`가 열린다. (AC4 이후 전부의 전제)
- [ ] 제보 dialog의 사진 썸네일을 눌러 원본이 새 탭에서 열린다. (AC6)
- [ ] 실제 제보 하나를 승인해 지도에 카페가 뜨는 것까지 확인한다. (AC9 + 육안)
- [ ] 반려한 제보가 제보자 화면에서 어떻게 보이는지 확인한다. (사용자 쪽 회귀)
- [ ] 사진을 교체한 뒤 마커 썸네일과 상세 캐러셀이 새 사진으로 바뀐다. (AC15)
- [ ] `/`와 `/cafes`를 이전과 나란히 놓고 시각 회귀가 없다. (AC20)
- [ ] 관리자 화면의 색이 `DESIGN.md` 팔레트 안에 있다. 새 색이 튀지 않는다.

## Technical Structure And Changes

### 새로 생기는 것

```
app/admin/
  layout.tsx                       가드 + 공통 셸 (큐레이터 아니면 notFound())
  page.tsx                         /admin/reports로 redirect
  reports/
    page.tsx                       서버 컴포넌트 — 목록 조회
    ReportsTable.tsx               클라이언트 — 탭·필터·행 선택
    ReportDialog.tsx               클라이언트 — 상세 + 승인/반려
    actions.ts                     'use server' — rejectReport / rejectEditRequest
  places/
    page.tsx                       목록
    new/page.tsx                   추가 (?report= 지원)
    [id]/edit/page.tsx             수정 (?request= 지원)
    PlaceForm.tsx                  클라이언트 — 추가·수정 공용
    LocationPicker.tsx             클라이언트 — 카카오맵 좌표 찍기
    PhotoManager.tsx               클라이언트 — 추가·교체·삭제
    actions.ts                     'use server' — createPlace / updatePlace

components/admin/                  관리자 전용 조각 (shadcn 조합)
components/ui/                     shadcn 생성물

lib/admin/
  guard.ts                         requireCurator() — 서버 전용
  reports.ts                       제보 조회·승인·반려 이음매 (서버 전용)
  places.ts                        places CRUD + 사진 이음매 (서버 전용)
  place-form.ts                    폼 값 ↔ DB 페이로드 변환 (순수 함수, 테스트 대상)
  place-form.test.ts

supabase/migrations/<버전>_curator_storage_policies.sql
```

### 고치는 것

| 파일 | 변경 |
|---|---|
| `types/kakao.d.ts` | `Geocoder`(`addressSearch`, `coord2Address`) 선언 추가 |
| `components/map/KakaoMap.tsx` | SDK URL에 `&libraries=services` — **공개 지도에도 같은 SDK가 쓰이므로 회귀 확인 대상이다** |
| `supabase/tests/20_rls_checks.sql` | 큐레이터 storage 케이스 |
| `docs/db-schema.md` · `CLAUDE.md` · `DESIGN.md` · `docs/scope.md` | R25 |
| `package.json` | tailwindcss v4, @tailwindcss/postcss, shadcn 의존성 |
| `postcss.config.mjs` (신규) · `components.json` (신규) | Tailwind·shadcn 설정 |

### 건드리지 않는 것

`lib/cafes.ts`, `lib/supabase.ts`, `lib/place-images.ts`, `app/page.tsx`,
`app/cafes/page.tsx`, `components/map/*`(SDK URL 한 줄 제외), `components/cafe/*`,
`components/bookmark/*`, `components/submission/*`, `proxy.ts`.

### 데이터 이음매 규칙 (기존 구조를 따른다)

`lib/cafes.ts`가 세운 규칙 — **컴포넌트가 테이블을 직접 건드리지 않는다** — 를 그대로
쓴다. 관리자 쪽 이음매는 `lib/admin/*.ts`이고 **서버 전용**이다(`lib/bookmarks.ts`가
브라우저 전용인 것과 대칭). Server Action은 그 위의 얇은 껍데기다.

`places` row → `Cafe` 변환이 필요하면 **`lib/cafes.ts`의 `toCafe()`를 빌려 쓴다.**
두 번째 변환 코드를 만들지 않는다. 단 관리자 목록은 `Cafe`가 아니라 `status`·
`updated_at`을 포함한 별도 행 타입을 쓴다 — `PLACE_COLUMNS`에 그 둘이 없고, 공개 조회에
넣을 이유도 없다.

### 마이그레이션 주의

Supabase MCP `apply_migration`으로 적용했으면 **로컬 파일명을 기록된 버전으로 바꾼다.**
`verify-schema.sh`가 파일명 순서로 돌기 때문에 새 파일에 앞선 시각을 붙이면 아직 없는
테이블을 건드려 깨진다.

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
```

## Tasks

`checklist.md`에 체크 가능한 형태로 같은 내용이 있다.

- **T1** Tailwind v4 + shadcn 설치. 스캔 범위를 `app/admin/**`·`components/admin/**`·
  `components/ui/**`로 제한하고, preflight가 공개 화면에 새지 않게 한다. 테마 변수를
  `DESIGN.md` 토큰에 매핑. (R26, R27)
- **T2** 큐레이터 storage 정책 마이그레이션 + `20_rls_checks.sql` 케이스. (R23, R24)
- **T3** `lib/admin/guard.ts` — `requireCurator()`. 세션 유저 → `profiles.role` 조회 →
  아니면 throw. 조회 결과를 요청 안에서 캐시한다(`React.cache`). (R1, R2)
- **T4** `app/admin/layout.tsx` 가드 + 셸, `app/admin/page.tsx` redirect. (R1, R3)
- **T5** `lib/admin/reports.ts` — 두 테이블 목록 조회(제보자 닉네임 join, 수정 요청은
  대상 카페 이름 join), 상태 필터, 반려 RPC 호출. (R4, R5, R7)
- **T6** `/admin/reports` 페이지 + 표 + 탭 + 필터. (R4, R5)
- **T7** `ReportDialog` — 상세 표시, 반려(사유 입력), 승인(폼으로 이동). (R6, R7, R8)
- **T8** `lib/admin/place-form.ts` — 폼 값 ↔ DB 페이로드 변환, `published` 사전 검증,
  사진 배열 계산, 경로 판별. **순수 함수로 두고 테스트를 같이 쓴다.** (R10, R12, R13, R14)
- **T9** `lib/admin/places.ts` — 목록 조회, insert/update, 사진 업로드·삭제. (R9, R12, R13, R15, R16)
- **T10** `/admin/places` 목록 페이지. (R9)
- **T11** `types/kakao.d.ts`에 `Geocoder` 추가 + `KakaoMap.tsx` SDK URL에 `libraries=services`.
  **공개 지도 회귀를 확인한다.** (R11)
- **T12** `LocationPicker` — 지도 클릭, 주소 검색, 역지오코딩, 키 없을 때 숫자 입력 폴백. (R11)
- **T13** `PhotoManager` — 추가·교체·삭제, 미리보기. `PhotoPicker.tsx`의 blob URL
  `useMemo` + cleanup effect 패턴을 따른다 (React Compiler 규칙이 다른 길을 막는다). (R12)
- **T14** `PlaceForm` — 필드 전체, 검증, 참고 영역(제보 사진·메모). (R10, R14, R17, R20)
- **T15** `app/admin/places/actions.ts` — `createPlace`/`updatePlace`. **R19의 저장 순서를
  그대로 구현하고 그 이유를 주석으로 남긴다.** 승인 실패 시 R21의 구분된 안내. (R2, R15, R18, R19, R21, R22)
- **T16** 문서 갱신 — `docs/db-schema.md`, `CLAUDE.md`, `DESIGN.md`, `docs/scope.md`. (R25)
- **T17** 검증 — `npm run verify`, `npm run build`, `./scripts/verify-schema.sh`,
  playwright-cli로 로그아웃 흐름. (AC17, AC18, AC19, AC1)

## Risks And Open Decisions

### 위험

**RK1. Tailwind preflight가 공개 화면을 무너뜨린다.** Tailwind v4의 전역 리셋이
`app/globals.css`보다 뒤에 실리면 지도·dock·마커가 통째로 어긋난다. **완화** — Tailwind
CSS를 `app/globals.css`가 아니라 `app/admin/`에서만 import하고, 공개 화면 스크린샷을
작업 전에 찍어 둔다. 이것이 이번 작업에서 공개 화면을 깨뜨릴 가장 큰 경로다.

**RK2. `libraries=services` 추가가 공개 지도에 영향을 준다.** 같은 `KakaoMap.tsx`를
`/`가 쓴다. SDK 번들이 커지고, `autoload=false` + `kakao.maps.load()` 타이밍이 미묘하게
달라질 수 있다. **완화** — T11 직후 `/`를 띄워 마커와 상세를 확인한다.
차선책: 관리자 폼만 별도 SDK 인스턴스를 쓴다.

**RK3. Server Action이 레이아웃 가드 뒤에 있다고 착각하는 것.** Next.js Server Action은
POST 엔드포인트로 직접 호출할 수 있어 레이아웃을 거치지 않는다. **R2가 이 위험 하나만을
위해 있다.** 액션마다 `requireCurator()` 첫 줄을 빠뜨리면 로그인한 아무나 카페를 만들 수
있게 된다 — 다만 RLS가 2차 방어선으로 남아 실제로는 DB가 거부한다.

**RK4. 승인 저장 순서를 틀리면 사진이 조용히 사라진다.** R19의 4단계 중 3과 4가 바뀌면
`places.photos` update가 승인 RPC가 붙인 제보 사진을 덮어쓴다. 테스트로 잡기 어렵고
화면에서도 "사진이 좀 적네" 정도로만 보인다. **완화** — AC9가 이것을 정확히 겨냥한다.

**RK5. 부분 실패로 어중간한 상태가 남는다.** `places` insert는 성공하고 사진 업로드가
실패하면 사진 없는 카페가 남는다. Server Action 하나에 트랜잭션을 걸 수 없다(storage가
DB 밖이다). **감수한다** — 관리자 화면이고 다시 열어 고치면 된다. R21이 그 사실을
화면에서 구분해 알리게 한다.

**RK6. `/admin`이 동적 렌더라 공개 라우트의 캐싱에 영향을 줄 수 있다.** 관리자 페이지는
쿠키를 읽으므로 당연히 동적이지만, 그 사실이 `/`나 `/cafes`로 새면 `revalidate = 300`이
죽는다. **완화** — AC19가 빌드 출력에서 확인한다.

### 이번 작업에서 정하지 않은 것

- **임시 이미지 9장을 무엇으로 교체할 것인가.** 이 화면이 교체 수단을 제공하지만,
  출처(직접 촬영 vs 매장 동의)는 여전히 미정이다(`CLAUDE.md` 열려 있는 결정).
  **사이트가 `noindex`인 이유가 이것이므로, 화면이 생겼다고 자동으로 풀리지 않는다.**
- **`work_policy` 9곳의 값.** 폼에 칸은 생기지만 채우는 것은 방문 확인의 문제다.
- **큐레이터를 더 만드는 방법.** 지금처럼 마이그레이션으로 한다.
- **`slug` 자동 생성.** 손으로 넣는다. 9곳 규모에서 자동화할 이유가 없다.

## Implementation Result Report Contract

구현이 끝나면 다음 형식으로 보고한다. **통과하지 못한 것을 통과했다고 쓰지 않는다.**

```md
## 구현 결과

### 만든 것
- 라우트: (실제로 생긴 경로 목록)
- 마이그레이션: <파일명> — 적용 방법(MCP / db push)과 기록된 버전

### 요구사항 대응
| 요구사항 | 상태 | 비고 |
|---|---|---|
| R1 | 충족 / 부분 / 미충족 | |
(R1~R27 전부. 부분·미충족은 이유를 적는다)

### 인수 조건
| 기준 | 결과 | 증거 |
|---|---|---|
| AC1 | 통과 / 실패 / 미확인 | 명령어 출력, SQL 결과, 스냅샷 |
(AC1~AC20 전부. **사람이 확인해야 하는 것은 "미확인 — 사람 확인 필요"로 남긴다.**
큐레이터 로그인이 필요한 AC4~AC16이 여기 해당한다)

### 검증 출력
- `npm run verify` — (결과)
- `npm run build` — (`/`와 `/cafes`의 렌더 방식 포함)
- `./scripts/verify-schema.sh` — (결과)

### PRD와 달라진 것
(구현하며 뒤집은 결정과 그 이유. 없으면 "없음")

### 사람이 해야 하는 것
(카카오 로그인이 필요한 확인, 남은 결정)
```
