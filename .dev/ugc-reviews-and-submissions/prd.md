# PRD: 장소 리뷰 · 수정 요청 · 신규 제보 (UGC 입력 3종)

> **상태: 구현 완료 (2026-08-20).** 구현하면서 뒤집은 결정이 넷 있고, 본문은 **최종
> 결과 기준**으로 갱신했다. 무엇이 왜 뒤집혔는지는 아래 「구현 중 뒤집은 결정」에 있다.
> 커밋: `fd29426` (스키마·데이터 계층) · `5abec5e` (화면) · `d4a20f3` (문서)
>
> **2026-08-20 코드 리뷰 후속.** 9건을 고쳤다 — 가장 큰 것은 **승인 경로가 애초에
> 동작하지 않았다는 것**이다. 나머지는 리뷰 조회 경합, 업로드 개수 상한,
> 세션 판정 전 클릭, 스크립트 페이지네이션, 롤백 누락이다.
>
> **2026-08-21.** 그 수정이 대시보드 SQL까지 막은 것을 발견해 조건을 넓히고, **사진
> 이관을 아예 없앴다.** 이관 하나 때문에 승인 전체가 service_role 키에 묶여 있었다.
> 이제 승인은 SQL 한 줄이고 `scripts/approve-submission.mjs`는 지웠다.

## Summary

로그인 사용자가 데이터를 밀어 넣는 입구 세 개를 연다.

1. **리뷰** — 기존 장소를 `good` / `normal` / `bad`로 평가한다. 1인 1평가, 다시 누르면 해제.
2. **수정 요청** — 기존 장소에 사진과 메모를 붙여 보낸다. `place_edit_requests`.
3. **신규 제보** — 네이버 URL, 사진 여러 장, 메모로 새 장소를 제보한다. `place_reports`.

셋 다 **제출까지만** 만든다. 검수 화면은 만들지 않고, 승인·반려는 Supabase 대시보드와
운영 스크립트로 처리한다.

착수 시점에는 `place_submissions` 한 테이블이 `kind`로 셋(신규·수정·폐업)을 겸하고 있었고
(`20260814000002_profiles_and_submissions.sql`) 화면만 없는 상태였다. 구현 중에 **담는
정보가 서로 달라 두 테이블로 갈랐다** — 아래 「구현 중 뒤집은 결정」 1번.

## 구현 중 뒤집은 결정

착수 때의 판단과 다르게 간 것들이다. 넷 다 이유가 있고, 코드와 `CLAUDE.md`·`docs/`는
아래 결과를 따른다.

**1. 제보 테이블을 둘로 갈랐다** (`place_submissions` → `place_reports` +
`place_edit_requests`). 원래는 한 테이블을 `kind`로 쓸 계획이었다. 문제는 셋의 필수
항목이 서로 다르다는 것이었다 — 신규 제보에는 네이버 URL이, 수정 요청에는 대상 카페가
반드시 있어야 하는데 한 테이블에 두면 **둘 다 nullable이 되어 DB가 아무것도 보장하지
못한다.** 공통 컬럼이 `payload jsonb` 하나뿐이었던 것도 그래서였다. 가르면서 payload를
걷어내고 `naver_place_url`·`photos`가 이름을 갖게 했다.
→ 잃은 것: 폐업 신고(`kind='closed'`) 자리. 화면이 없어 쓰인 적이 없다.

**2. 승인 함수가 카페를 만들지 않는다.** 옛 `approve_submission()`은
`jsonb_populate_record`로 payload를 `places`에 부었는데, 그 payload는 사실 운영자가 승인
직전에 손으로 채운 값이었다 — **사용자가 보내지 않은 것을 보낸 것처럼 다루는 구조**였다.
지금은 큐레이터가 `places`를 직접 만들거나 고치고, 함수는 연결·상태 전환·확인일 갱신만 한다
(`approve_place_report(제보id, 카페id)` / `approve_edit_request(요청id)`).

**3. 사진 버킷을 하나로 합쳤다.** 검수 전 사진을 비공개 `submission-images`에 두는 것이
원래 설계였다. "카페 관련 이미지는 전부 한 버킷을 쓴다"는 결정으로 뒤집어, `place-images`
안의 `submissions/<uid>/` 접두사로 옮겼다.
→ 대가: **검수 전 사진도 URL을 알면 열린다.** 방어선은 둘 — 사용자는 자기 uid 폴더에만
쓸 수 있고(카페 사진 자리 `<slug>/`에는 못 쓴다), 버킷에 5MB·이미지 3종 제한이 걸려 있다.
→ 얻은 것: 승인이 버킷 간 이동이 아니라 같은 버킷의 경로 변경이 됐다.

**4. 사진 값의 모양이 테이블마다 다르다.** `places.photos`는 **경로**(`naruteo.jpeg`),
제보 두 테이블의 `photos`는 **공개 URL**이다. 목적이 달라서다 — 전자는 오래 남아 앱이 매번
읽으므로 URL을 담으면 프로젝트 ref가 데이터에 박히고, 후자는 검수자가 대시보드에서 값을
그대로 클릭해 열 수 있어야 한다. 조립·해체는 `lib/place-images.ts` 한 곳에만 있다.

## Problem And Goal

**문제.** 장소 데이터가 운영자 수기 시드뿐이라 9곳에서 멈춰 있다. `docs/scope.md`의 미해결
가정 2번이 이것을 "MVP 최대 병목"으로 지목했고, 크롤링은 약관 위반으로 배제돼 있어
(`docs/mvp-decisions.md` 2-1) 직접 방문 외에 데이터를 늘릴 경로가 없다. 동시에 가정 3번은
`work_fit`·`noise` 라벨을 무슨 근거로 매겼는지 문서화되지 않았다고 적고 있다 — 라벨이 맞는지
확인할 신호도 없다.

**목표.** 사용자가 (a) 기존 라벨이 맞는지 한 번의 클릭으로 되먹이고, (b) 틀린 정보와 사진을
고쳐 보내고, (c) 목록에 없는 카페를 제보할 수 있게 한다. 승인 판단은 여전히 사람이 한다.

**목표가 아닌 것.** 리뷰 수를 늘리는 것도, 제보를 자동 반영하는 것도 아니다. 이번 성패는
"로그인한 사람이 실제로 세 동작을 완료할 수 있는가"와 "그 데이터가 RLS를 통과해 안전하게
쌓이는가"다.

## Users And Use Cases

| 사용자 | 상태 | 하는 일 |
|---|---|---|
| 방문자 | 로그아웃 | 지도·상세·리뷰 집계를 본다. 리뷰 버튼과 제보 버튼도 **보이지만** 누르면 로그인 모달이 뜬다 |
| 로그인 사용자 | 카카오 로그인 | 평가하고, 수정 요청하고, 새 장소를 제보한다 |
| 큐레이터 | `profiles.role in ('curator','admin')` | 대시보드에서 `places`를 만들거나 고친 뒤 승인 함수·스크립트로 제보를 연결한다 |

착수 시점 가입자는 1명(`hanb`, `role='user'`)이고 큐레이터가 0명이라 승인 자체가
불가능했다. `20260820113105_promote_curator.sql`이 그 계정을 `curator`로 올렸다.

주요 흐름:

1. 상세 패널에서 `보통`을 누른다 → 즉시 반영되고 집계가 1 오른다. 새로고침해도 남는다.
2. 상세 하단 `정보가 다른가요?`를 누른다 → 모달에서 사진 2장과 메모를 붙여 보낸다 →
   `place_edit_requests`에 `pending`으로 쌓인다.
3. dock의 `카페 제보하기`를 누른다 → 네이버 URL·사진·메모를 넣고 보낸다 → `place_reports`.
4. 운영자가 `places`에 카페를 만들고(제보에는 이름·주소·좌표가 없다) 대시보드에서
   `select public.approve_place_report('<제보id>', '<카페id>', '<큐레이터uuid>')`를 친다
   → 사진이 `places.photos`에 붙고 제보가 `approved`가 된다.

## Pre-Work

구현 전에 확인·반영해야 하는 것들.

- **`docs/scope.md`가 제보·리뷰를 명시적으로 1차 범위 밖에 두고 있다**(2026-08-15 변경 이력:
  "제보·리뷰는 여전히 제외다. 그쪽은 콜드스타트가 그대로 걸린다"). 코드보다 이 문서를 먼저
  갱신한다 — 저장소 관행이 그렇다(`CLAUDE.md`: 로그인·북마크 때 두 번 다 문서를 먼저 갱신했다).
- **`DESIGN.md`의 "모달은 로그인 안내 하나뿐이다"를 뒤집어야 한다.** 폼 모달 두 개가 새로
  생긴다. 상세 패널 구성 순서(1-7번)에 리뷰 섹션이 몇 번으로 들어가는지도 `DESIGN.md`에
  적고 나서 코드를 붙인다.
- **새 색·새 스케일을 만들지 않는다.** `app/globals.css`의 `:root` 토큰만 쓴다
  (`--sp-*`, `--r-*`, `--shadow-brew`, 팔레트).
- `data/cafes.json`은 손대지 않는다. 런타임 원본이 아니다.

## Non-Goals

- **큐레이터 검수 화면(`/admin`).** 승인·반려는 대시보드에서 SQL로 한다.
- ~~**승인 시 사진 자동 이관.**~~ → **이관 자체를 없앴다.** 사진은 `submissions/<uid>/`에
  그대로 두고 `places.photos`가 그 경로를 가리킨다. 옮기려면 `<slug>/` 쓰기 권한이
  필요한데, 그 하나 때문에 승인 전체가 service_role 키에 묶였다 (2026-08-21).
- **폐업 신고.** 테이블을 가르면서 `kind='closed'` 자리도 없앴다. 필요해지면
  `place_closure_reports`를 따로 만든다.
- **리뷰 본문 텍스트, 리뷰 목록, 작성자 표시, 신고·차단.**
- **리뷰가 `work_fit`·`noise`·`last_verified`를 자동으로 바꾸는 것.** 리뷰는 큐레이션 값과
  섞이지 않는 별개 신호다.
- **제보 인센티브(포인트·뱃지).** `docs/scope.md`가 미룬 그대로 둔다.
- **검색바(`DESIGN.md` Left Panel 4번).** 여전히 비워둔다.

## Requirements

### 리뷰

- **R1.** `public.place_reviews` 테이블을 만든다. PK는 `(user_id, place_id)`라 한 사람이 한
  장소에 하나만 남긴다. 값은 `place_review_value` enum(`good`/`normal`/`bad`)이다.
  `user_id`는 `auth.users(id)`, `place_id`는 `places(id)`를 참조하고 둘 다 `on delete cascade`다.
- **R2.** `place_reviews`의 RLS는 SELECT·INSERT·UPDATE·DELETE 넷을 한 마이그레이션에서
  같이 정의한다. 넷 다 `user_id = (select auth.uid())` 기준이고, UPDATE는 `using`과
  `with check`를 모두 건다. **큐레이터 예외를 두지 않는다** — 북마크와 같은 이유로 남의
  평가를 개인 식별 가능한 형태로 읽을 이유가 없다.
- **R3.** 집계는 `public.place_review_counts(p_place_id uuid)` `security definer` 함수로만
  노출한다. 반환은 `(good integer, normal integer, bad integer)` 한 행이고 실행 권한은
  `anon`·`authenticated`에 준다. **`place_reviews`를 직접 select할 수 있게 열지 않는다** —
  열면 누가 어디에 `bad`를 눌렀는지 전부 보인다.
- **R4.** 상세 패널에 리뷰 섹션을 인라인으로 그린다. 버튼 세 개(`좋아요`/`보통`/`별로`)와
  집계 한 줄이다. 내가 고른 값은 눌린 상태로 보이고, 같은 값을 다시 누르면 해제된다.
  집계가 0건이면 숫자 대신 평가를 유도하는 한 줄을 보여준다.
- **R5.** 리뷰 반영은 낙관적이다. 내 선택과 집계(내 변화분)가 누른 즉시 바뀌고, 요청이
  실패하면 이전 상태로 되돌린다. 북마크 하트와 같은 규칙이다.
- **R5-1.** **누른 뒤에 도착한 조회 응답이 화면을 되돌리면 안 된다.** effect의 의존성은
  클릭으로 바뀌지 않으므로 cleanup의 `cancelled`로는 막히지 않는다. 한 번이라도 누른
  뒤에는 조회 결과를 무시하고, 요청이 끝나면 **서버 집계를 다시 받아 맞춘다** — 내 평가를
  모르는 채 누른 경우 낙관적 증감이 한쪽으로 치우쳐 숫자가 영구히 어긋나기 때문이다.
- **R6.** 색은 `good`을 고른 경우에만 든다(`--pastel-mint` 배경 + `--positive-text`).
  `normal`·`bad`가 선택된 상태는 무채색으로 표현한다 — `DESIGN.md`의 "부정 상태에는 색을
  주지 않는다"를 따른다.

### 사진 업로드

- **R7.** 사진은 카페 사진과 **같은 버킷**(`place-images`)에 올라간다. 검수 전에는
  `submissions/<uid>/` 접두사 아래에 있다가, 승인되면 같은 버킷의 `<slug>/`로 옮겨간다.
  공개 버킷에 사용자가 쓰게 되므로 버킷에 제한을 건다 — `file_size_limit` 5MB,
  `allowed_mime_types`는 `image/jpeg`·`image/png`·`image/webp`. 버킷은 대시보드에서
  만들어져 마이그레이션에 정의가 없었으므로 upsert로 보장한다.
- **R8.** `storage.objects`에 정책을 건다. 경로가 `submissions/<본인 uid>/`여야 한다
  (`(storage.foldername(name))[1] = 'submissions'` and `[2] = (select auth.uid())::text`).
  - INSERT: 본인 폴더에만. **카페 사진 자리(`<slug>/`)에는 쓸 수 없다** — 그리로 옮기는
    것은 `service_role`을 쓰는 운영 스크립트뿐이다.
  - DELETE: 본인 폴더만 (제출 실패 시 되돌리기·제출 전 정리용).
  - SELECT: **정책을 만들지 않는다.** 공개 버킷이라 읽기는 정책이 아니라 공개 URL로
    이뤄진다. 만들면 통제하고 있다는 인상만 준다.
  - UPDATE: **정책을 만들지 않는다.** 파일마다 새 uuid를 쓰므로 덮어쓸 일이 없다.
    빠뜨린 것과 구분되게 주석으로 의도를 남긴다.
  - 모든 정책에 `bucket_id = 'place-images'` 조건을 반드시 함께 건다. 빠뜨리면
    **모든 버킷**에 적용된다.
- **R8-1.** storage 마이그레이션에서 **하지 말아야 할 두 가지.** 2026-08-20에 실제 프로젝트를
  조회해 확인한 사실이다.
  - **`alter table storage.objects enable row level security`를 쓰지 않는다.** RLS는 이미
    켜져 있고(`relrowsecurity = true`), `alter table`은 소유자만 실행할 수 있는데 소유자는
    `supabase_storage_admin`이고 마이그레이션을 도는 `postgres`는 그 롤의 멤버가 아니다.
    쓰면 거기서 깨진다. **`create policy`는 예외적으로 통과한다** — 실제로 만들어 보고
    롤백해 확인했다.
  - **`grant`를 쓰지 않는다.** `authenticated`는 `storage.objects`에 대한 INSERT·SELECT를
    이미 갖고 있다. 접근을 가르는 것은 grant가 아니라 정책이다.
- **R9.** 업로드 경로는 `submissions/<uid>/<uuid>.<ext>`다. 파일명에 원본 이름을 쓰지
  않는다. 클라이언트는 업로드 전에 mime·용량·장수를 검사하고, 걸리면 업로드를 시도하지
  않고 폼에 사유를 보여준다.
- **R10.** 제보 두 테이블의 `photos text[]`에는 **공개 URL**이 들어간다. 검수자가
  대시보드에서 값을 그대로 클릭해 사진을 열 수 있어야 하기 때문이다. check 제약이
  `place-images` 공개 객체 URL 모양을 강제하므로 외부 CDN 이미지도, 경로만 적은 값도
  거부된다. **`places.photos`는 반대로 경로만 담는다** — 대비는 「구현 중 뒤집은 결정」 4번.
- **R10-1.** 제출이 실패하면 방금 올린 사진을 **그 자리에서 지운다**
  (`removePhotos()`). 사진은 제출 버튼을 누를 때 올라가고 insert가 그 뒤에 오므로,
  중간에 실패하면(중복 제보, 업로드 도중 실패) 아무도 가리키지 않는 파일이 남는다.
  storage 정책이 본인 폴더 delete를 열어 두어 **사용자 세션만으로 된다.**
  지우기에 실패해도 **던지지 않는다** — 사용자가 알아야 할 원래 실패를 덮는다.
  놓친 것은 `scripts/prune-orphan-photos.mjs`가 걷어간다(안전망).

### 수정 요청 (`place_edit_requests`)

- **R11.** 상세 패널 하단의 진입점을 누르면 모달이 열리고, 사진(0~5장)과 메모를 받는다.
  둘 다 비면 제출 버튼은 비활성이다.
- **R12.** 제출은 `place_edit_requests`에 `place_id`(슬러그를 uuid로 변환한 값),
  `photos`(공개 URL 배열), `note = 메모`로 insert한다. `status`와 `submitted_by`는 넣지
  않는다 — 컬럼 default가 각각 `'pending'`과 `auth.uid()`이고 insert 정책이 그 둘을 본다.
  사진도 메모도 없는 요청은 `place_edit_requests_has_content` 제약이 DB에서도 막는다.
- **R13.** 같은 사용자가 같은 장소에 대기 중 요청을 이미 갖고 있으면
  `place_edit_requests_one_pending_per_place` unique index가 거부한다(SQLSTATE 23505).
  **원본 에러 문구를 그대로 노출하지 않고** "이미 검토를 기다리는 요청이 있어요"로 바꿔
  보여준다.

### 신규 제보 (`place_reports`)

- **R14.** dock의 진입점을 누르면 모달이 열리고 네이버 URL(필수), 사진(0~5장), 메모(선택)를
  받는다.
- **R15.** 네이버 URL은 `https://`로 시작하고 host가 `naver.com` 또는 `naver.me`로 끝나야
  한다. 아니면 제출을 막고 폼에 사유를 보여준다.
- **R16.** 제출 전에 같은 `naver_place_url`을 가진 공개 카페가 있는지 조회하고, 있으면
  제출 대신 "이미 등록된 카페예요"로 안내하며 그 카페를 상세로 열 수 있게 한다.
  `places_naver_place_url_key` unique index 때문에 승인 시점에 어차피 막히는 제보다.
- **R17.** 제출은 `place_reports`에 `naver_place_url`, `photos`(공개 URL 배열), `note`로
  insert한다. **`place_id`를 채우면 안 된다** — 아직 카페가 없고
  `place_reports_pending_has_no_place`가 그것을 강제한다. 승인 시점에
  `approve_place_report()`가 큐레이터가 만든 카페를 가리키게 채운다.
- **R18.** 이 제보만으로는 승인이 되지 않는다는 것을 폼에서 한 줄로 알린다
  (예: 확인 후 지도에 올라간다는 안내). 사용자가 "왜 안 보이지?"로 가지 않게 한다.

### 로그인 게이트

- **R19.** 세 동작 모두 로그인이 필요하다. 로그아웃 상태에서도 버튼은 **보이고**, 누르면
  저장 대신 로그인 모달이 뜬다 — 상세 하트와 같은 규칙(`DESIGN.md` 2026-08-15 변경).
- **R19-1.** 세션 판정이 끝나기 전(`resolved === false`)에는 로그인 모달을 띄우지
  않는다. dock의 제보 버튼과 리뷰 chip은 `AuthDock`과 달리 첫 페인트부터 떠 있어서,
  이미 로그인한 사람이 복구 중에 누르면 "로그인이 필요해요"를 보게 된다.
- **R20.** 로그인 여부 판정은 한 곳에만 둔다. 지금 `BookmarkProvider.toggle()`에 있는 것을
  `AuthProvider`로 끌어올려 `requireLogin(reason)` 형태로 노출하고, 북마크·리뷰·제보가
  모두 그것을 부른다. 버튼마다 판정을 두지 않는다.
- **R21.** `LoginRequiredModal`의 본문 문구는 이유에 따라 달라진다(북마크 / 리뷰 / 제보).
  지금 문구는 북마크 전용으로 하드코딩돼 있다.

### 데이터 접근 이음매

- **R22.** 컴포넌트는 `place_reviews`·`place_reports`·`place_edit_requests`·Storage를
  직접 건드리지 않는다.
  `lib/reviews.ts`와 `lib/submissions.ts`를 새로 만들고 그 파일들만 Supabase를 부른다.
  `lib/cafes.ts`·`lib/bookmarks.ts`와 같은 규칙이며, 세션이 필요하므로 둘 다 **브라우저 전용**이다.
- **R23.** slug → uuid 변환 코드는 하나만 존재한다. 지금 `lib/bookmarks.ts`에 비공개로 있는
  `resolvePlaceId()`를 공용 모듈로 빼고 북마크·리뷰·제보가 같이 쓴다. 두 번째 변환 코드를
  만들지 않는다.

### 운영

- **R24.** `hanb`(`3e339f8f-cee8-45e7-a506-655079dad4dc`)의 `profiles.role`을 `curator`로
  올리는 마이그레이션을 넣는다. 없으면 승인 함수가 항상 예외를 던진다.
  대상 행이 없는 환경(검증 컨테이너)에서는 0행 업데이트로 조용히 지나가야 한다.

- **R24-1.** 승인은 **SQL 한 줄**이다. `approve_place_report(제보id, 카페id, 승인자)` /
  `approve_edit_request(요청id, 승인자)`가 사진까지 붙이고(공개 URL → 경로, 중복은
  건너뜀) 상태를 바꾼다. **service_role 키도 스크립트도 필요 없다** — 대시보드 SQL
  편집기에서 그대로 된다.
- **R24-2.** 승인 함수는 승인자를 인자로 받는다(`p_reviewer`). 세션 없는 호출
  (대시보드 SQL·psql·service_role)에서는 `auth.uid()`가 NULL이기 때문이다. 세션이 있으면
  인자는 무시되므로(`coalesce(auth.uid(), p_reviewer)`) 사칭 경로는 열리지 않는다.
- **R7-1.** 업로드 개수 상한을 **서버에서** 건다. `MAX_PHOTOS`는 클라이언트에만 있고
  anon 키는 브라우저에 나가므로, 공개 버킷의 자기 폴더에 무한정 올릴 수 있었다.
  storage 정책이 `submission_photo_count() < 20`을 함께 검사한다.

### 검증 인프라

- **R25.** `scripts/verify-schema.sh`가 새 마이그레이션을 포함해 그대로 통과해야 한다.
  `supabase/tests/00_stub_supabase.sql`에 `storage` 스키마 스텁(`buckets`, `objects`,
  `storage.foldername()`)을 추가한다 — 지금 스텁에는 storage가 없어 R7·R8 마이그레이션이
  거기서 깨진다.
- **R26.** `supabase/tests/20_rls_checks.sql`에 리뷰·제보·storage 케이스를 추가한다.
  최소한: 남의 리뷰가 안 보인다 / 남의 uid로 리뷰를 못 넣는다 / 집계 함수는 anon도 부를 수
  있다 / 남의 폴더에 파일을 못 넣는다.

## Acceptance Criteria

- **AC1.** 로그인 상태에서 상세의 `좋아요`를 누르면 버튼이 즉시 선택 상태가 되고, 새로고침
  후에도 선택이 유지된다. (브라우저 — `playwright-cli`)
- **AC2.** 같은 버튼을 다시 누르면 해제되고, 다른 버튼을 누르면 그쪽으로 옮겨간다. 어느
  경우에도 `place_reviews`에 그 사용자·장소 행이 **0개 또는 1개**다.
  (SQL — `select count(*) from place_reviews where user_id=... and place_id=...`)
- **AC3.** `select * from public.place_review_counts('<place uuid>')`를 `anon` 역할로 실행하면
  집계가 나오고, 같은 역할로 `select * from public.place_reviews`는 0행이다.
  (`supabase/tests/20_rls_checks.sql`)
- **AC4.** 로그아웃 상태에서 리뷰 버튼을 누르면 리뷰가 저장되지 않고 로그인 모달이 뜬다.
  모달 본문이 북마크가 아니라 **리뷰** 문구다. (브라우저)
- **AC5.** `good`을 고른 버튼만 민트 계열 색이 든다. `normal`·`bad` 선택 상태에는 색이 없다.
  (스크린샷 — 색 판별이라 예외적으로 `screenshot`을 쓴다)
- **AC6.** 수정 요청 모달에서 사진 1장과 메모를 넣고 보내면 `place_edit_requests`에
  `status='pending'`, `photos`(공개 URL), `note`가 채워진 행이 1건 생긴다. (SQL)
- **AC7.** 같은 장소에 곧바로 한 번 더 보내면 저장되지 않고 "이미 검토를 기다리는 요청이
  있어요" 문구가 폼에 뜬다. Postgres 원문(`duplicate key value ...`)이 화면에 노출되지 않는다.
  (브라우저)
- **AC8.** 신규 제보 모달에서 `https://naver.me/xxxx` + 사진 2장 + 메모를 보내면
  `place_reports`에 `place_id is null`, `naver_place_url`, `photos`가 채워진 행이 생긴다. (SQL)
- **AC9.** 네이버가 아닌 URL(`https://example.com/a`)을 넣으면 제출이 막히고 사유가 폼에 뜬다.
  네트워크 요청이 나가지 않는다. (브라우저 — `playwright-cli console` / 네트워크)
- **AC10.** 업로드된 파일이 `place-images` 버킷의 `submissions/<uid>/` 아래에 있고,
  테이블에 담긴 공개 URL이 **로그인 없이 열린다**(200 + `image/*`). 공개 버킷으로 합친
  결과이며, 검수자가 대시보드에서 값을 클릭해 여는 것이 이 요구의 목적이다. (curl)
- **AC11.** 다른 uid 폴더나 카페 사진 자리(`<slug>/`)로 insert를 시도하면 storage 정책이
  막는다. (`supabase/tests/20_rls_checks.sql`)
- **AC12.** 큐레이터가 `places`에 카페를 만든 뒤
  `select approve_place_report('<제보id>','<카페id>','<큐레이터uuid>')`를 실행하면,
  제보 사진이 `places.photos`에 경로로 붙고 `status`가 `approved`, `place_id`가 그 카페로
  바뀐다. 두 번째 호출은 거부된다. (`supabase/tests/10_schema_checks.sql` 8절)
- **AC12-1.** 제출이 실패하면(같은 대상에 두 번째 요청) 방금 올린 사진이 버킷에 남지 않는다.
  (`scripts/prune-orphan-photos.mjs`가 고아 0장을 보고한다)
- **AC13.** `npm run verify`가 통과한다. `npm run lint`는 `--max-warnings=0`이므로 warning도
  남기지 않는다.
- **AC14.** `./scripts/verify-schema.sh`가 `✅ 통과`로 끝난다.
- **AC15.** `app/page.tsx`가 정적 렌더를 유지한다 — 리뷰 집계 때문에 서버에서 쿠키를 읽지
  않는다. (`npm run build` 출력에서 `/` 라우트가 동적으로 바뀌지 않았는지 확인)
- **AC16.** `docs/scope.md`·`DESIGN.md`·`docs/db-schema.md`가 갱신돼 있고, `DESIGN.md`에
  리뷰 섹션의 상세 패널 내 위치와 모달 규칙 변경이 적혀 있다. (파일 diff)

## Verification - Agent

```bash
npm run verify              # lint → typecheck → test
./scripts/verify-schema.sh  # 마이그레이션 + 제약 + RLS
npm run build               # AC15 — / 라우트가 정적인지
```

브라우저(개발 서버를 먼저 띄운다 — `npm run dev`, 포트 3030 고정):

```bash
playwright-cli open http://localhost:3030
playwright-cli snapshot        # 기본. screenshot은 AC5 색 확인에만
playwright-cli console
```

에이전트가 확인할 수 있는 범위는 **로그아웃 상태까지**다 — AC4, AC9, 그리고 로그인 모달이
뜨는 것까지. 카카오 자격증명 입력은 하지 않는다(`CLAUDE.md` 브라우저 검증 규칙).

SQL 확인은 Supabase MCP(`execute_sql`)로 한다. 리뷰·제보 행 확인(AC2, AC6, AC8)은 사람이
로그인해 동작한 뒤에야 데이터가 생기므로, 에이전트는 **쿼리를 준비해 두고 결과를 사람에게서
받는다.**

## Verification - Human

로그인이 필요한 구간은 사람이 한다.

1. 카카오로 로그인한다.
2. 아무 카페 상세에서 `좋아요` → 새로고침 → 선택이 남는지 (AC1)
3. 같은 버튼 다시 → 해제되는지, `보통`으로 옮겨가는지 (AC2)
4. 수정 요청 모달에서 사진 1장 + 메모 제출 → 성공 문구 (AC6)
5. 곧바로 같은 카페에 또 제출 → 안내 문구가 뜨고 Postgres 원문이 안 보이는지 (AC7)
6. 신규 제보 모달에서 네이버 URL + 사진 2장 제출 (AC8)
7. Supabase 대시보드 Storage에서 `place-images/submissions/<내 uid>/`에 파일이 있는지,
   테이블의 URL을 클릭하면 사진이 열리는지 (AC10)
8. `places`에 카페를 만든 뒤 대시보드 SQL로 `approve_place_report(...)` 승인 (AC12)
9. 중복 제보를 일부러 내고 `prune-orphan-photos.mjs`로 고아가 0장인지 (AC12-1)
9. 색 확인 (AC5)

## Technical Structure And Changes

### 새로 만드는 마이그레이션

실제로 만들어진 것은 아홉 개다. 하루 안에 결정이 몇 번 뒤집혀 앞의 것을 뒤의 것이
고치는 모양이 됐다 — 이미 적용된 마이그레이션은 고치지 않고 새 파일로 덮는 것이 규칙이다.

| 파일 | 내용 |
|---|---|
| `20260820113048_place_reviews.sql` | enum + 테이블 + 인덱스 + RLS 4종 + `place_review_counts()` |
| `20260820113058_submission_images_bucket.sql` | **비워둠(폐기).** 비공개 버킷을 만들었다가 같은 날 접었다 |
| `20260820113105_promote_curator.sql` | `hanb`를 `curator`로 |
| `20260820115447_split_submissions.sql` | 제보를 `place_reports` + `place_edit_requests`로 가름, payload 제거, 승인 함수 넷 |
| `20260820121425_place_photos_as_paths.sql` | `places.photos`를 절대 URL → 버킷 경로로 |
| `20260820121437_submission_photos_public.sql` | 제보 사진을 `place-images`로, 컬럼명 `photos`로 통일, storage 정책 이전 |
| `20260820121718_photos_reject_blank.sql` | 사진 제약을 제대로 조임(원소 안의 공백·빈 문자열) |
| `20260820124135_clear_old_submission_photo_paths.sql` | 옛 버킷을 가리키던 경로 비우기 |
| `20260820125519_submission_photos_as_urls.sql` | 제보 두 테이블의 `photos`를 공개 URL로 |

RLS와 정책 SQL은 **같은 파일 안에** 둔다(`CLAUDE.md` — 마이그레이션 체크).

⚠️ **버킷 삭제는 마이그레이션으로 못 한다.** `storage.protect_delete`가 storage 테이블
직접 삭제를 막는다(고아 오브젝트 방지). 폐기된 `submission-images`는 대시보드에서 지운다.

### 새 파일

```
lib/place-id.ts                        # slug → places.id (브라우저 전용, 북마크에서 추출)
lib/place-images.ts                    # 경로 ↔ 공개 URL. 카페 이미지의 유일한 출처
lib/place-images.test.ts
lib/reviews.ts                         # 내 평가 조회·설정·해제, 집계 조회
lib/reviews.test.ts
lib/submissions.ts                     # 사진 업로드·되돌리기 + 제보 insert, 에러 번역
lib/submissions.test.ts
components/review/ReviewSection.tsx    # 상세 인라인 버튼 3개 + 집계 한 줄
components/review/ReviewSection.test.tsx
components/submission/SubmissionModal.tsx  # 폼 모달 껍데기 (두 모달 공용)
components/submission/EditRequestModal.tsx
components/submission/NewPlaceModal.tsx
components/submission/PhotoPicker.tsx  # 파일 선택·미리보기·검증 (두 모달 공용)
components/submission/PhotoPicker.test.tsx
scripts/prune-orphan-photos.mjs        # 버려진 제보 사진 청소 (service_role)
```

**`ReviewProvider`는 만들지 않았다.** 리뷰를 보는 곳이 상세 하나뿐이고 `CafeCard`가
카페마다 `key`로 새로 마운트돼 상태가 저절로 초기화되므로, 소비자가 하나뿐인 context는
규칙이 아니라 겹이다. 낙관적 갱신과 에러 복구는 `ReviewSection` 안에 그대로 있다.

### 고치는 파일

| 파일 | 변경 |
|---|---|
| `components/auth/AuthProvider.tsx` | `requireLogin(reason)` / `loginPrompt: reason \| null` 추가 (R20) |
| `components/auth/LoginRequiredModal.tsx` | 이유별 문구 (R21) |
| `components/bookmark/BookmarkProvider.tsx` | 자체 `loginPrompt` 제거, `requireLogin` 사용. `resolvePlaceId`를 `lib/place-id.ts`에서 import |
| `components/cafe/CafeCard.tsx` | 리뷰 섹션 + 수정 요청 진입점 |
| `components/map/MapView.tsx` | `useAuth`로 로그인 유도 읽기, 모달 두 개 렌더, dock에 제보 진입점 |
| `app/globals.css` | 새 컴포넌트 스타일 (**기존 토큰만**) |
| `supabase/tests/00_stub_supabase.sql` | storage 스텁 (R25) |
| `supabase/tests/20_rls_checks.sql` | 리뷰·storage 케이스 (R26) |
| `lib/cafes.ts` | `toCafe()`가 사진 경로를 공개 URL로 바꾼다, `getCafeByNaverUrl()` 추가 |
| `types/cafe.ts`, `test/fixtures.ts` | `photos`가 경로/URL 중 무엇인지 주석 |
| `docs/scope.md`, `DESIGN.md`, `docs/db-schema.md`, `CLAUDE.md` | 문서 갱신 |

### 구조를 바꾸지 않는 것

- **`PLACE_COLUMNS`는 그대로다.** 리뷰는 `places` 컬럼이 아니다. 다만 `toCafe()`는
  바뀌었다 — 사진 경로를 공개 URL로 바꾸는 자리가 여기다(컴포넌트는 버킷을 모른다).
- **`app/page.tsx`의 `revalidate = 300`을 유지한다.** 집계는 상세를 열 때 클라이언트가 그
  장소 것만 가져온다. 서버에서 집계를 함께 불러오면 라우트가 동적이 되거나 최대 5분 묵은
  숫자를 그리게 된다.
- `types/kakao.d.ts`, 지도·마커 코드는 변경 없음.

## Tasks

- **T1.** `place_reviews` 마이그레이션 — enum, 테이블, `place_id` 인덱스, RLS 4종,
  `place_review_counts()` + grant/revoke.
- **T2.** `place-images` 버킷 제한(5MB·이미지 3종) + `storage.objects` 정책 마이그레이션.
  SELECT·UPDATE 정책을 만들지 않은 이유를 주석으로 남긴다.
- **T3.** `hanb` 큐레이터 승격 마이그레이션.
- **T4.** `00_stub_supabase.sql`에 storage 스텁 추가, `20_rls_checks.sql`에 리뷰·storage 검증
  추가. `./scripts/verify-schema.sh` 통과시킨다.
- **T5.** `lib/place-id.ts` 추출 + `lib/bookmarks.ts` 리팩터(동작 변화 없음).
- **T6.** `lib/reviews.ts` — `getMyReview`, `getReviewCounts`, `setReview`, `clearReview`.
- **T7.** `lib/submissions.ts` — 파일 검증, 업로드, 실패 시 되돌리기(`removePhotos`),
  `submitEdit`, `submitNewPlace`, 중복(23505) 에러 번역, 네이버 URL 검증, 중복 카페 조회.
- **T7-1.** `lib/place-images.ts` — 경로 ↔ 공개 URL. `toCafe()`가 이것을 쓴다.
- **T8.** `AuthProvider`에 `requireLogin(reason)` 추가, `BookmarkProvider`에서 판정 제거,
  `LoginRequiredModal` 이유별 문구.
- **T9.** `ReviewSection`을 만들어 `CafeCard`에 삽입, 낙관적 갱신 (provider는 두지 않았다).
- **T10.** `PhotoPicker` + `EditRequestModal` + 상세 하단 진입점.
- **T11.** `NewPlaceModal` + dock 진입점.
- **T12.** `app/globals.css` 스타일 (기존 토큰만, 새 색·새 여백 금지).
- **T13.** vitest — `lib/reviews.test.ts`, `lib/submissions.test.ts`,
  `lib/place-images.test.ts`, `components/review/ReviewSection.test.tsx`,
  `components/submission/PhotoPicker.test.tsx`. 세션이 필요한 컴포넌트는
  `@/lib/supabase-browser` 하나만 `vi.mock`한다(`CafeCard.test.tsx` 패턴).
- **T13-1.** 제보 테이블 분리·이미지 규칙에 맞춰 `supabase/tests/*`를 다시 쓴다.
- **T14.** 문서 갱신 — `docs/scope.md`(범위 이동 + 변경 이력),
  `DESIGN.md`(리뷰 섹션 위치, 모달 규칙 변경, 새 컴포넌트 규격),
  `docs/db-schema.md`(RLS 요약표에 `place_reviews`·storage 추가), `CLAUDE.md`(로그인 판정
  위치가 `AuthProvider`로 옮겨간 것).
- **T15.** `npm run verify`, `./scripts/verify-schema.sh`, `npm run build`, 로그아웃 상태
  브라우저 확인.
- **T16.** 운영 스크립트 — `prune-orphan-photos.mjs`(버려진 사진 청소, dry-run 기본).
  승인은 SQL 한 줄이라 스크립트가 없다.

## Risks And Open Decisions

- **집계로 개인이 드러난다.** 지금 사용자가 1명이라 `좋아요 1`은 곧 "그 사람이 좋아요를
  눌렀다"다. MVP에서는 감수하되, 사용자가 늘기 전에 최소 표시 인원(예: 3명 미만이면 숫자를
  가림) 규칙이 필요할 수 있다. **이번 범위에서는 넣지 않는다.**
- **콜드스타트.** 카페 9곳 대부분이 "아직 평가가 없어요"로 뜬다. 빈 상태 카피가 화면
  품질을 좌우한다 — `DESIGN.md` 말투 기준을 따른다.
- ~~`photo_paths`를 `photos`로 잘못 넣으면 승인이 깨진다~~ → **사라졌다.** payload jsonb를
  걷어내면서 사진이 진짜 컬럼이 됐고, 값의 모양은 이제 check 제약이 막는다(앱 코드 규칙이
  아니라 DB가 보장한다).
- **검수 전 사진이 공개 URL을 갖는다.** 버킷을 하나로 합친 대가다. 파일명이 uuid라 추측은
  어렵지만 인증이 필요하지 않다는 뜻이고, 이것을 되돌리려면 「구현 중 뒤집은 결정」 3번을
  먼저 뒤집어야 한다.
- **제보 테이블의 URL에는 프로젝트 ref가 박힌다.** 프로젝트를 옮기면 그 행들의 URL이 죽는다.
  검수가 끝나면 수명이 끝나는 데이터라 감수한 것이고, 오래 남는 `places.photos`는 경로라
  영향이 없다.
- **버려진 업로드가 쌓인다.** 사진은 제출할 때 올라가고 insert가 그 뒤에 오므로, 중간에
  실패하면 파일만 남는다. 앱이 그 자리에서 되돌리고(R10-1), 놓친 것은
  `scripts/prune-orphan-photos.mjs`가 걷어간다. 아예 안 생기게 하려면 업로드를 insert
  뒤로 미뤄야 하는데, 그러면 실패할 때마다 사용자가 사진을 다시 골라야 한다.
- ~~storage 정책을 마이그레이션으로 만드는 것이 프로젝트 권한에 걸릴 수 있다~~ →
  **해소됨 (2026-08-20).** 실제 프로젝트에 붙어 확인했다. `storage.objects` 소유자는
  `supabase_storage_admin`이고 `postgres`는 그 롤의 멤버가 아니지만, **정책 생성과 버킷
  insert는 둘 다 통과한다**(만들어 보고 롤백해 확인). 대시보드 우회 경로는 필요 없다.
  대신 `alter table` / `grant`는 쓰면 안 된다 — R8-1 참고.
- **열려 있는 결정은 건드리지 않는다.** `work_policy` 도입 여부(`docs/scope.md` 미확정 ②)와
  임시 이미지 교체는 이 PRD의 범위 밖이다. 제보 폼에 `work_policy`를 넣지 않는다.
- **버킷을 지우는 것은 SQL로 안 된다.** `storage.protect_delete`가 막는다. 폐기된
  `submission-images`는 대시보드에서 지워야 하고, 남아 있어도 앱 동작에는 영향이 없다.
- **`resolvePlaceId` 이동으로 동작이 바뀌면 안 된다.** 지금은 브라우저 세션 클라이언트로
  조회한다. 옮긴 뒤에도 같은 클라이언트를 쓴다 — 세션 없는 클라이언트로 바꾸면 draft 장소를
  못 찾게 된다.

## Implementation Result Report Contract

구현을 마치면 아래 형식으로 보고한다. 통과하지 못한 항목은 빼지 말고 실패로 적는다.

```md
## 구현 결과

### 요구사항 대응
| 요구사항 | 상태 | 근거 (파일:줄 또는 명령) |
|---|---|---|
| R1 | 완료 / 미완료 / 범위 제외 | |

### 인수 조건
| AC | 결과 | 증거 |
|---|---|---|
| AC1 | 통과 / 실패 / 사람 확인 필요 | 명령 출력, 스냅샷, SQL 결과 |

### 검증 명령 출력
- `npm run verify` — (실제 출력 요약)
- `./scripts/verify-schema.sh` — (실제 출력 요약)
- `npm run build` — `/` 라우트 렌더 방식

### 사람이 확인해야 하는 것
- (로그인 뒤에만 확인 가능한 항목과, 그때 실행할 SQL을 그대로 적는다)

### 남긴 것 · 어긋난 것
- (PRD와 다르게 구현한 부분과 그 이유. 없으면 "없음")
```
