# Context Notes: UGC 입력 3종

구현 에이전트가 다시 찾아다니지 않도록, 탐색에서 확인한 사실만 적는다.
추측은 넣지 않았다.

> **2026-08-20 갱신.** 아래 「착수 시점의 상태」는 그때의 기록이고, 구현하면서 여러 개가
> 바뀌었다. **지금 코드를 만질 사람은 「현재 상태」부터 읽는다.**

## 현재 상태 (구현 후)

| 항목 | 상태 |
|---|---|
| 제보 테이블 | **둘.** `place_reports`(신규, `naver_place_url` 필수) · `place_edit_requests`(수정, `place_id` 필수). `place_submissions`와 `payload jsonb`는 없앴다 |
| 승인 함수 | `approve_place_report(제보id, 카페id)` · `approve_edit_request(요청id)` + 반려 둘. **카페를 만들지 않는다** — 큐레이터가 `places`를 다룬 뒤 연결·상태 전환만 |
| 승인 절차 | `node --env-file=.env.local scripts/approve-submission.mjs report <제보id> <카페id>`. 파일 이동은 Postgres가 못 해서 스크립트가 한다 |
| 리뷰 | `place_reviews`(PK `(user_id, place_id)`) + `place_review_counts(uuid)` 집계 함수. 테이블 select는 본인만 |
| Storage 버킷 | **`place-images` 하나.** 5MB·이미지 3종 제한. 검수 전 사진은 `submissions/<uid>/`, 승인되면 `<slug>/` |
| `storage.objects` 정책 | insert·delete 둘. `bucket_id='place-images'` + `submissions/<본인 uid>/` 조건. SELECT·UPDATE는 일부러 없다 |
| 사진 값의 모양 | `places.photos`는 **경로**, 제보 두 테이블의 `photos`는 **공개 URL**. check 제약이 서로를 막는다 |
| URL 조립·해체 | `lib/place-images.ts` 하나뿐 (`placeImageUrl` / `placeImagePath`) |
| 버려진 사진 | 실패 시 앱이 되돌리고(`removePhotos`), 놓친 것은 `scripts/prune-orphan-photos.mjs` |
| 큐레이터 | `hanb` 한 명 (`20260820113105_promote_curator.sql`) |
| 폐기됨 | `submission-images` 버킷(대시보드에서 삭제 필요 — SQL로는 `storage.protect_delete`가 막는다), `kind='closed'` 폐업 신고 자리 |

## 착수 시점의 상태 (기록)

| 항목 | 상태 |
|---|---|
| `place_submissions` 테이블·제약·RLS | **있다.** `supabase/migrations/20260814000002_profiles_and_submissions.sql` |
| `approve_submission()` / `reject_submission()` | **있다.** 같은 파일. `security definer`, `authenticated`에 execute grant |
| `is_curator(uuid)` | **있다.** RLS 재귀를 피하려고 `security definer`로 뺀 함수. 새 정책도 이걸 쓴다 |
| 리뷰 테이블 | **없다.** 전부 신규 |
| Storage 버킷 | `place-images` 하나뿐. `public = true`, `file_size_limit`·`allowed_mime_types` 모두 null |
| `storage.objects` 정책 | **하나도 없다.** (`select * from pg_policies where schemaname='storage'` → 0행) 즉 지금은 로그인 사용자도 업로드할 수 없다 |
| `storage.objects` RLS | **이미 켜져 있다** (`relrowsecurity = true`). 우리가 켜면 안 된다 |
| 큐레이터 | **0명.** `profiles`에 `hanb`(`3e339f8f-cee8-45e7-a506-655079dad4dc`, `role='user'`) 한 명뿐 |
| `/admin` 등 라우트 | 없다. `app/` 아래는 `page.tsx`, `layout.tsx`, `auth/callback/route.ts`뿐 |

### `place_submissions`에서 걸리던 제약들 — **테이블째 없어졌다**

아래는 `20260820115447_split_submissions.sql` 이전의 이야기다. 두 테이블로 가르면서
`payload`가 사라졌고, 그 제약들도 함께 사라졌다. 지금의 제약은 `docs/db-schema.md`에 있다.

파일: `supabase/migrations/20260814000002_profiles_and_submissions.sql`

- `submissions_target_required` — `kind <> 'new'`면 `place_id`가 있어야 한다.
- `submissions_new_has_no_target_while_pending` — `kind='new'`이고 `pending`이면 `place_id`는
  **null이어야 한다.** 승인 시 함수가 채운다.
- `submissions_payload_keys` — `payload`에 `id`·`slug`·`status`·`created_by`·`verified_by`·
  `created_at`·`updated_at` 키가 있으면 거부. `photos`·`note`·`naver_place_url`은 허용된다.
- `place_submissions_one_pending_per_place` unique index —
  `(submitted_by, place_id) where status='pending' and place_id is not null`.
  같은 사람이 같은 장소에 대기 중 제보를 두 건 못 쌓는다. 위반 시 **SQLSTATE 23505**.
- RLS: insert는 `submitted_by = auth.uid() and status='pending'`만, select는 본인 또는 큐레이터.

### ⚠️ (해소됨) `payload.photos`를 쓰면 안 되던 이유

`approve_submission()`은 `jsonb_populate_record(p, s.payload)`로 payload를 `places` 행 모양에
붓는다. 그래서 `payload.photos`는 곧 `places.photos`가 된다. 그런데

- `places_photos_https` 제약(`20260814000004_places_photos.sql`)이 `^https://\S+` 형식을 요구하고,
- 우리 업로드는 **비공개 버킷 오브젝트 경로**라 URL이 아니다.

→ **이 함정은 사라졌다.** payload를 걷어내면서 사진이 진짜 컬럼(`photos`)이 됐고, 값의
모양은 앱 코드 규칙이 아니라 check 제약이 보장한다.

### ⚠️ 신규 제보만으로는 카페가 되지 않는다 — **지금도 유효하다**

`places`는 `name`·`address`·`lat`·`lng`가 not null이고
`places_hours_required`(`is_24h or (open_time and close_time)`)가 걸려 있다. 제보에는 그
값들이 없다. **의도된 것이다** — 큐레이터가 `places`를 직접 만들고, 승인 함수는 그 카페에
제보를 연결하기만 한다(clarify 결정의 연장).

## Storage 권한 — 2026-08-20에 실제 프로젝트에서 확인한 것

Supabase MCP로 붙어서 직접 확인했다. 프로브는 전부 롤백했고 스키마에 남긴 것은 없다.

| 확인 | 결과 |
|---|---|
| MCP 접속 역할 | `postgres` |
| `storage.objects` / `storage.buckets` 소유자 | `supabase_storage_admin` |
| `postgres`가 그 롤의 멤버인가 | **아니다** (`pg_auth_members`에 없다) |
| `postgres`가 `storage.objects`에 `create policy` | ✅ **된다** (생성 후 롤백해 확인) |
| `postgres`가 `storage.buckets`에 insert | ✅ **된다** (생성 후 롤백해 확인) |
| `storage.objects`의 RLS | 이미 `enabled` |
| `authenticated`의 `storage.objects` 권한 | INSERT·SELECT 이미 grant됨 (`anon`도 SELECT 있음) |
| `storage.foldername(name text)` | 있다. `text[]` 반환 |
| 소유자 컬럼 | `owner uuid`, `owner_id text` 둘 다 있다 |

여기에 하나가 더 있다 — **삭제는 막혀 있다.** `storage.protect_delete` 트리거가
storage 테이블의 직접 삭제를 거부한다("Direct deletion from storage tables is not allowed.
Use the Storage API instead."). 고아 오브젝트를 막는 가드이므로 우회하지 않는다. 버킷·파일을
지우려면 대시보드나 Storage API(=service_role 스크립트)를 쓴다.

그래서 마이그레이션은 이렇게 쓴다. (버킷을 하나로 합친 뒤의 최종 모양)

```sql
-- 버킷: 대시보드에서 만들어진 것이라 정의가 없었다. upsert로 보장하고 제한을 건다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
   set file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- 정책: bucket_id 조건을 반드시 함께 건다. 빼면 모든 버킷에 걸린다.
-- 경로가 곧 권한이다 — submissions/<본인 uid>/ 아래만 쓸 수 있고,
-- 카페 사진 자리(<slug>/)는 service_role 스크립트만 건드린다.
create policy "place_images_insert_own_submission"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
```

**쓰면 안 되는 것 둘.**

- `alter table storage.objects enable row level security` — 이미 켜져 있고, `alter table`은
  소유자만 되므로 여기서 마이그레이션이 깨진다. (`create policy`는 통과하는데 `alter table`은
  안 된다. 헷갈리기 쉬운 지점이다.)
- `grant ... on storage.objects to authenticated` — 이미 있다. 접근을 가르는 것은 grant가
  아니라 정책이다.

## 이 저장소가 지키는 규칙 (코드를 붙이기 전에 읽을 것)

- **데이터 접근은 `lib/` 이음매로만.** `lib/cafes.ts`(공개 조회, 세션 없음),
  `lib/bookmarks.ts`(브라우저 전용, 세션 필요). 컴포넌트가 테이블을 직접 부르지 않는다.
- **`toCafe()`는 하나뿐이다.** places row → Cafe 변환을 두 번 만들지 않는다.
  사진 경로를 공개 URL로 바꾸는 것도 여기서 한다(`lib/place-images.ts`를 부른다).
- **slug ↔ uuid.** 앱 키는 `places.slug`, FK는 uuid. 변환은 `lib/place-id.ts`
  하나뿐이고 북마크·리뷰·제보가 같이 쓴다.
- **`app/page.tsx`의 `revalidate = 300`을 죽이지 않는다.** 서버에서 쿠키를 읽는 순간
  라우트가 동적이 된다. 그래서 세션이 필요한 것은 전부 클라이언트에서 읽는다
  (`AuthProvider`가 그 이유로 존재한다).
- **`(select auth.uid())`로 감싼다.** 기존 정책이 전부 이 형태다.
- **RLS는 4개 명령을 한 번에 설계하고, `enable row level security`와 정책을 같은
  마이그레이션에 넣는다.** 일부러 안 여는 명령은 주석으로 의도를 남긴다
  (`bookmarks`의 UPDATE가 그 예다).
- **`npm run lint`는 `--max-warnings=0`.** 커밋할 때 `.githooks/pre-commit`이
  `npm run verify`를 자동으로 돌린다(4~5초).
- **테스트는 대상 옆에.** `globals: false`라 `describe`/`it`/`expect`를 `vitest`에서
  import한다. 더미는 `test/fixtures.ts`의 `makeCafe()`/`makePlaceRow()`.
  세션이 필요한 컴포넌트는 `@/lib/supabase-browser` **하나만** `vi.mock`하고
  AuthProvider·BookmarkProvider는 실제로 돌린다 (`components/cafe/CafeCard.test.tsx` 참고).

## 붙일 자리 (파일별)

### `components/auth/AuthProvider.tsx`
`AuthState`는 `{ user, resolved, error, signIn, signOut }`. 로그인 판정을 여기로 올린다.
지금 로그인 유도(`loginPrompt`)는 `BookmarkProvider`에 있고 `MapView`가 그것을 읽어
`LoginRequiredModal`을 띄운다. 기능이 셋이 되면 판정 위치가 하나여야 하므로
`requireLogin(reason)`으로 옮긴다.

### `components/bookmark/BookmarkProvider.tsx`
낙관적 갱신의 본보기다. 조회 결과에 주인(`userId`)을 같이 들고 **렌더 중에** 판정한다 —
effect로 비우지 않는 이유가 주석에 있다. 리뷰 상태도 같은 모양으로 만든다.

### `components/cafe/CafeCard.tsx`
상세 패널. 순서는 사진 → 주소 → 이름(+하트) → 네이버 링크 → Quick Check → 태그 → 확인일.
`DESIGN.md`가 정한 순서이고, 하트는 순서에 항목을 추가하지 않으려고 이름 줄 안에 넣었다.
**리뷰 섹션이 몇 번으로 들어가는지 `DESIGN.md`에 먼저 적고 넣는다.**

### `components/map/MapView.tsx`
`AuthProvider > BookmarkProvider > MapShell` 구조. 모달은 `MapShell` 맨 아래에서
`loginPrompt`를 보고 렌더한다. dock(`.brand-dock`)에 제보 진입점이 들어간다.

### `components/auth/LoginRequiredModal.tsx`
본문이 북마크 전용으로 하드코딩돼 있다("카페를 북마크에 저장하려면…"). 이유별로 가른다.
Escape·배경 클릭·`나중에` 셋 다 닫히고 열릴 때 포커스를 안으로 옮긴다 — 새 모달도 이걸 따른다.

### `app/globals.css`
`:root`에 토큰이 전부 있다. 쓸 것: `--sp-xs~xl`(4/8/16/24/32), `--r-sm/md/lg/panel/full`,
`--shadow-brew`, `--pastel-mint`, `--positive-text`, `--surface-container-*`, `--outline-variant`.
**다크 모드 분기는 만들지 않는다.**

## 검증 인프라

- `./scripts/verify-schema.sh` — 일회용 `postgres:16-alpine` 컨테이너에
  `supabase/tests/00_stub_supabase.sql` → 모든 마이그레이션 → `10_schema_checks.sql` →
  `20_rls_checks.sql` 순으로 적용한다. Docker가 필요하다.
- **스텁에 `storage` 스키마가 없다.** `00_stub_supabase.sql`은 `auth.users`, `auth.uid()`,
  `anon`/`authenticated`/`service_role` 역할, 기본 grant만 만든다. 버킷·정책 마이그레이션을
  추가하면 **여기서 깨진다.** `storage.buckets`·`storage.objects`·`storage.foldername(text)`
  스텁을 같이 넣어야 한다.
- `20_rls_checks.sql`의 패턴: `begin; set local role authenticated;
  set local test.uid = '...';` 로 사용자를 흉내 내고, 막혀야 하는 동작은
  `do $$ ... exception when insufficient_privilege then raise notice 'OK: ...' end $$;`로 감싼다.
  기존 uid: 큐레이터 `1111...`, 제보자 `2222...`, 제3자 `3333...`.
- Supabase MCP로 실제 프로젝트 조회가 된다(`execute_sql`, `list_storage_buckets`).
  프로젝트 ref는 `palzceynjixnbqjsagpq`.

## 브라우저 확인

`npm run dev`(포트 **3030** 고정, 카카오 콘솔 도메인 등록 때문에 변경 불가) 후
`playwright-cli open http://localhost:3030`. `snapshot`이 기본이고 `screenshot`은 색 확인처럼
눈으로만 판별되는 것에만 쓴다. **카카오 로그인은 사람이 한다** — 에이전트는 로그아웃 흐름까지만
확인하고 나머지는 확인하지 못했다고 말한다.


## 구현 후에 알게 된 것 (다음 사람이 밟지 않게)

- **배열 원소 안의 공백은 `array_to_string(arr, ' ')`으로 못 잡는다.** 구분자로 쓴 공백과
  값 안의 공백이 이어붙인 문자열에서 구별되지 않는다(`array['a b.jpg']`가 통과한다).
  빈 구분자(`array_to_string(arr, '')`)로 이어붙이면 남은 공백은 전부 값 안의 것이다.
- **제약을 바꿀 때는 옛 제약을 먼저 뗀다.** 값을 먼저 바꾸려 하면 옛 제약이 그 update를
  막는다(URL → 경로 전환에서 실제로 걸렸다).
- **MCP `apply_migration`은 자체 타임스탬프로 기록한다.** 로컬 파일명을 그 버전에 맞춰
  바꿔야 나중에 `db push`가 같은 마이그레이션을 다시 적용하려 들지 않는다.
  (`20260815000001_bookmarks.sql`은 원격에 `20260815094921`로 기록돼 있다 — 이번 작업 이전부터
  어긋나 있던 것이라 손대지 않았다.)
- **이미 적용된 마이그레이션은 고치지 않는다.** 폐기된 것은 내용을 비우고 이유를 주석으로
  남긴다(`20260820113058_submission_images_bucket.sql`이 그 예다).
- **가짜 세션으로는 Storage를 못 쓴다.** 로그인 뒤 화면을 보려고 쿠키를 심고 인증 응답을
  가로챌 수는 있지만(시각 확인용), 업로드는 JWT가 가짜라 거부된다. 실제 제출 확인은 사람이 한다.
