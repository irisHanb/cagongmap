# Context Notes: 관리자 운영 화면

`prd.md`를 실행할 때 필요한 저장소 사실을 모아 둔 것이다. **여기 적힌 것은 다시
찾아보지 않아도 된다.** 2026-08-21 기준.

## 이 저장소의 기본기

- **포트는 3030 고정.** 카카오 콘솔 플랫폼 도메인이 `http://localhost:3030`이라
  다른 포트로 띄우면 지도가 뜨지 않는다.
- **`npm run lint`는 `--max-warnings=0`.** warning 하나도 커밋을 막는다.
- **타입체크는 `npm run typecheck`.** `npx tsc --noEmit` 단독 호출은 Next가 만드는
  전역 타입(`LayoutProps` 등)을 몰라 실패한다.
- **커밋마다 `npm run verify`가 pre-commit 훅으로 돈다**(`.githooks/pre-commit`, 4~5초).
  훅은 **작업 트리를 본다, 스테이지가 아니다.**
- **React Compiler 규칙이 둘을 error로 막는다** — effect 안 `setState`, 렌더 중 ref 읽기.
  blob URL 같은 "렌더에서 만들고 정리할 값"은 `useMemo` + cleanup effect로 푼다
  (`components/submission/PhotoPicker.tsx`가 그 예이고 주석에 한계까지 적혀 있다).
- **Vitest는 `globals: false`.** `describe`/`it`/`expect`를 매 파일에서 import한다.
  더미는 `test/fixtures.ts`의 `makeCafe()`/`makePlaceRow()`를 쓴다.
- **`AGENTS.md`는 `next dev`가 매번 다시 쓴다.** 직접 편집하지 않는다. Next 16이라
  기존 예제와 다른 부분이 있으니 `node_modules/next/dist/docs/`를 본다.
- 브라우저 확인은 `playwright-cli` skill. `snapshot`이 기본이고 `screenshot`은
  눈으로만 판별되는 것(레이아웃·색)에만 쓴다.

## 이미 존재하는 것 (새로 만들지 말 것)

### 승인 · 반려 RPC 넷

`20260820135828_fix_approval_and_upload_cap.sql` + `20260821012109_approve_attaches_photos.sql`

```sql
approve_place_report(p_report_id uuid, p_place_id uuid, p_reviewer uuid default null)
approve_edit_request(p_request_id uuid, p_reviewer uuid default null)
reject_place_report(p_report_id uuid, p_reason text default null, p_reviewer uuid default null)
reject_edit_request(p_request_id uuid, p_reason text default null, p_reviewer uuid default null)
```

- 넷 다 `security definer`, `authenticated`에 grant, `public`·`anon`에서 revoke.
- 승인자 판정은 `resolve_reviewer(p_reviewer)` 한 곳 —
  `coalesce(auth.uid(), case when auth.role()='service_role' then p_reviewer end)`.
  **세션이 있으면 세 번째 인자는 무시된다.** 우리는 세션으로 부르므로 **인자를 넘기지 않는다.**
- **승인 함수가 카페를 만들지도 고치지도 않는다.** `approve_place_report`는 이미
  존재하는 `p_place_id`를 요구하고(없으면 예외), `approve_edit_request`는
  `places.last_verified = current_date` · `verified_by`만 옮긴다.
- **둘 다 `attach_submission_photos(place_id, photos)`를 부른다.** 제보의 공개 URL을
  `regexp_replace`로 경로로 되짚어 `places.photos`에 **이어 붙인다**(이미 있으면 건너뛴다).
  → 폼이 제보 사진을 또 넣으면 안 되고, `photos` update가 승인 RPC보다 **앞에** 와야 한다.
- 상태가 `pending`이 아니면 예외를 던진다: `이미 처리된 제보입니다 (status=%)`.

### 권한

- `public.is_curator(uid uuid)` — `security definer`. `profiles.role in ('curator','admin')`.
  **정책 안에서 `profiles`를 직접 select하면 RLS가 재귀하므로 이 함수가 있다.**
- `profiles` 테이블: `id`(= `auth.users.id`), `nickname`, `role`(`user`/`curator`/`admin`).
  `profiles_select_all` 정책이 있어 **닉네임 join이 가능하다.**
- 현재 큐레이터는 `3e339f8f-cee8-45e7-a506-655079dad4dc` 하나
  (`20260820113105_promote_curator.sql`). 승격은 마이그레이션이나 service_role로만 된다 —
  `profiles_update_own`의 `with check`가 본인 승격을 막는다.
- `places`·`place_reports`·`place_edit_requests` 모두 큐레이터 `for all` 정책이 이미 있다.
  **세션으로 부르면 CRUD가 그대로 통과한다.** 새 테이블 정책이 필요 없다.

### 테이블 모양

`places` (`20260814000001_places.sql`)

| 컬럼 | 비고 |
|---|---|
| `id` uuid PK | |
| `slug` text unique **nullable** | 앱의 키. `toCafe()`가 `Cafe.id`로 옮긴다 |
| `name`, `address` | not null |
| `district` | nullable, address에서 뽑은 자치구 |
| `lat`, `lng` | check `33~39` / `124~132` |
| `naver_place_url` | 부분 unique 인덱스 (not null인 것끼리) |
| `open_time`, `close_time` | **text + 정규식 `^([01][0-9]\|2[0-3]):[0-5][0-9]$`.** time이 아니다 |
| `is_24h` | not null default false |
| `iced_americano_price` | int, `>= 0` |
| `outlet` / `noise` / `work_fit` / `work_policy` | enum, nullable |
| `wifi` | boolean nullable |
| `tags` | text[] not null default `{}` |
| `status` | enum `draft`/`published`/`hidden`/`closed`, default `draft` |
| `last_verified` | date |
| `verified_by`, `created_by` | uuid → auth.users |
| `created_at`, `updated_at` | `places_set_updated_at` 트리거가 `updated_at`을 갱신 |
| `photos` | text[] — **경로**. check가 URL(`://`)을 거부 |

제약 둘:
- `places_hours_required` — `is_24h` 아니면 `open_time`·`close_time` 둘 다 필요.
- `places_published_requires_core` — `published`면 `outlet`·`wifi`·`noise`·`work_fit`·
  `last_verified`가 전부 not null.

`place_reports` — `naver_place_url`(필수, `^https://\S+$`), `photos`(**공개 URL**),
`note`, `status`, `place_id`(승인 시), `submitted_by`(default `auth.uid()`),
`reviewed_by`/`reviewed_at`/`review_note`, `created_at`.
제약: pending이면 `place_id is null`, approved면 `place_id is not null`.
부분 unique: `(submitted_by, naver_place_url) where status='pending'`.

`place_edit_requests` — `place_id`(필수), `photos`(**공개 URL**), `note`, 나머지 동일.
제약: `photos`나 `note` 중 하나는 있어야 한다.
부분 unique: `(submitted_by, place_id) where status='pending'`.

**둘 다 DELETE 정책이 없다.** 의도된 설계다(반려가 있다).

### Storage

- 버킷은 **`place-images` 하나.** public, 5MB, `image/jpeg`·`image/png`·`image/webp`.
- **`submission-images`는 폐기됐다**(`20260820113058_…`은 내용이 비어 있고 파일만 남았다).
  storage 테이블은 SQL로 못 지운다(`storage.protect_delete`).
- 경로가 곧 상태다.

  | 경로 | 뜻 | 지금 쓸 수 있는 주체 |
  |---|---|---|
  | `submissions/<uid>/<uuid>.jpg` | 검수 전 제보 사진 | 본인 (insert·delete 정책) |
  | `<slug>/<uuid>.jpg` | 승인된 카페 사진 | **service_role만** ← T2가 여는 지점 |

- 기존 정책 이름: `place_images_insert_own_submission`,
  `place_images_delete_own_submission`. `bucket_id` 조건이 반드시 함께 걸려 있다.
- **폴더당 20장 상한**을 `submission_photo_count()`가 건다. 그 함수는 **`places.photos`가
  이미 쓰는 사진을 세지 않는다** — 승인된 사진은 검수 폴더에 남지만 자리를 차지하지 않는다.
- **승인해도 사진을 옮기지 않는다.** `submissions/<uid>/`에 그대로 두고
  `places.photos`가 그 경로를 가리킨다. 옮기려면 `<slug>/` 쓰기 권한이 필요했고,
  그 하나 때문에 승인 전체가 service_role에 묶여 있었다(2026-08-21에 걷어냈다).

### 이음매 파일

| 파일 | 역할 | 실행 위치 |
|---|---|---|
| `lib/cafes.ts` | `PLACE_COLUMNS`, `PlaceRow`, `toCafe()`, `getCafes()`, `getCafeById()` | 서버(세션 없음) |
| `lib/supabase.ts` | 공개 조회용, `persistSession: false` | 아무데나 |
| `lib/supabase-browser.ts` | 클라이언트 컴포넌트 | 브라우저 |
| `lib/supabase-server.ts` | **`createServerSupabase()` — route handler·서버 액션 전용** | 서버 |
| `lib/supabase-env.ts` | 환경변수 검사 하나뿐. import 시점에 throw | — |
| `lib/place-images.ts` | `placeImageUrl()` / `placeImagePath()` / `PLACE_IMAGE_BUCKET` | 아무데나 |
| `lib/place-id.ts` | `resolvePlaceId()`, `isUuid()` — **브라우저 전용**(getBrowserSupabase) | 브라우저 |
| `lib/submissions.ts` | `checkPhotos()`, `MAX_PHOTOS`, `ALLOWED_MIME`, `uploadPhotos()`, `removePhotos()` | 브라우저 |
| `lib/bookmarks.ts` | 북마크 | 브라우저 |
| `lib/reviews.ts` | 리뷰 | 브라우저 |

**`PLACE_COLUMNS`는 한 줄 리터럴이어야 한다.** 이어붙이면 supabase-js가 결과 타입을
추론하지 못하고 `GenericStringError`로 떨어진다. 관리자 목록은 `status`·`updated_at`이
필요한데 그 둘이 `PLACE_COLUMNS`에 없다 → **별도 상수를 만들되 역시 한 줄 리터럴로.**

**재사용할 것**: `checkPhotos()`(파일 검증 규칙), `ALLOWED_MIME`(확장자 매핑),
`MAX_PHOTO_BYTES`, `placeImageUrl`/`placeImagePath`, `toCafe()`.
`uploadPhotos()`는 **브라우저 전용에 `submissions/<uid>/` 경로가 박혀 있어** 그대로 못
쓴다 — 서버판을 `lib/admin/places.ts`에 따로 쓰되 검증 규칙은 빌려 온다.

## 함정 (이번 작업에서 실제로 밟을 수 있는 것)

1. **Server Action은 레이아웃 가드 뒤에 있지 않다.** 별도 POST 엔드포인트다.
   액션마다 `requireCurator()`를 첫 줄에 둔다.
2. **승인 RPC가 사진을 이어 붙인다.** `photos` update → 승인 RPC 순서를 지킨다.
   뒤집으면 제보 사진이 조용히 사라진다.
3. **`places.photos`는 경로, 제보 테이블은 URL.** check 제약이 서로를 막는다.
   조립·해체는 `lib/place-images.ts` 밖에서 하지 않는다.
4. **`open_time`/`close_time`은 `HH:mm` text다.** `<input type="time">`이 `HH:mm`을
   주므로 그대로 맞지만, 브라우저에 따라 `HH:mm:ss`가 올 수 있다 — 잘라서 넣는다.
5. **쿠키를 읽으면 그 라우트가 동적이 된다.** `/admin`은 당연히 동적이지만 그 사실이
   `/`·`/cafes`로 새면 `revalidate = 300`이 죽는다.
6. **Supabase MCP `apply_migration`은 파일명을 무시하고 자체 타임스탬프로 기록한다.**
   적용 후 기록된 버전으로 로컬 파일명을 바꾼다. `verify-schema.sh`가 **파일명 순서**로
   돌기 때문에, 새 파일에 앞선 시각을 붙이면 아직 없는 테이블을 건드려 깨진다.
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
   ```
7. **이미 적용된 마이그레이션의 내용을 고치지 않는다.** 새 파일로 덮는다.
8. **storage 마이그레이션에서 `alter table … enable row level security`와 `grant`를
   쓰지 않는다.** 이미 켜져 있고 이미 grant돼 있으며 `alter table`은 소유자만 된다.
9. **`error.tsx`의 두 번째 prop은 `reset`이 아니라 `retry`다** (Next 16).
10. **세션 갱신 파일은 `middleware.ts`가 아니라 `proxy.ts`다** (Next 16).

## 디자인 기준

`DESIGN.md`가 루트에 있다. frontmatter에 토큰이, 본문에 "어디에 쓰고 어디에 쓰지
않는지"가 있다. **금지 항목(`Don't`)은 본문에만 있다.**

관리자 화면은 shadcn을 쓰지만 **색은 같은 팔레트를 쓴다.** 매핑 참고:

| shadcn 변수 | DESIGN.md 토큰 |
|---|---|
| `--background` | `surface` `#fffaf8` |
| `--foreground` | `on-surface` `#211b1a` |
| `--card` | `surface-container-lowest` `#ffffff` |
| `--muted` | `surface-container` `#f3eae7` |
| `--muted-foreground` | `on-surface-variant` `#5b504d` |
| `--border` | `outline-variant` `#e2d5d1` |
| `--primary` | `primary` `#88484a` |
| `--primary-foreground` | `on-primary` `#ffffff` |
| `--radius` | `rounded.md` `16px` |

지켜야 할 규칙 둘:
- **다크 모드를 만들지 않는다.** 팔레트가 라이트 하나뿐이다.
- **부정 상태(반려·실패·빈 상태)에 경고색을 주지 않는다.** 색이 드는 것은 좋은 조건뿐이다.
  → 관리자 표의 `rejected` 배지에 빨강을 쓰지 않는다. 이 규칙은 관리자 화면에도 남긴다.

## 검증 도구

```bash
npm run verify                 # lint → typecheck → test:run
npm run build                  # 라우트 렌더 방식이 출력에 나온다
npm run test:run               # vitest 1회
./scripts/verify-schema.sh     # docker로 일회용 PG에 마이그레이션 전체 + 제약·RLS 검사
```

`supabase/tests/` 구성:
- `00_stub_supabase.sql` — `auth` 스키마, `anon`/`authenticated` 역할, storage 스텁
  (`buckets`, `objects`, `storage.foldername`)을 흉내 낸다.
- `10_schema_checks.sql` — 제약. `set local`을 쓰므로 단일 트랜잭션(`-1`)으로 돈다.
- `20_rls_checks.sql` — RLS. `set local role` + `set local test.uid`로 사용자를 바꾼다.
  기존 uid: `11111111-…`(큐레이터), `22222222-…`(제보자), `33333333-…`(제3자).

**여기서 통과한다고 실제 Supabase의 기본 grant까지 검증된 것은 아니다.**

## 관련 문서

| 문서 | 이번 작업과의 관계 |
|---|---|
| `CLAUDE.md` | 규칙의 원본. 관리자 화면 절을 여기에 추가한다 |
| `DESIGN.md` | 색·여백·말투. Tailwind 예외를 여기에 명시한다 |
| `docs/db-schema.md` | RLS 요약표를 갱신한다 |
| `docs/scope.md` | "검수 화면 없음" 서술을 갱신한다. 미확정 이슈 ③이 살아 있다 |
| `docs/mvp-decisions.md` | 크롤링 금지·사진 호스팅 결정의 근거 |
| `.dev/ugc-reviews-and-submissions/` | 제보 입구를 만든 직전 작업. **「구현 중 뒤집은 결정」 4개를 읽어 두면 왜 지금 구조가 이런지 알 수 있다** |

## 아직 열려 있는 결정 (이 작업이 닫지 않는다)

- **임시 이미지 9장의 출처.** 사이트가 `noindex`인 이유가 이것이다. 관리자 화면이
  교체 수단을 주지만 출처는 여전히 미정 — **화면이 생겼다고 `noindex`를 풀지 않는다.**
- **`work_policy` 9곳의 값.** 방문 확인이 필요하다.
- **검증할 핵심 가설** (`scope.md` 미확정 이슈 ③).
