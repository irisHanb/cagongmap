# DB 스키마 초안 (Supabase / Postgres)

> 상태: **초안**. 로컬 Postgres 16에서 검증했으나 아직 어떤 Supabase 프로젝트에도 적용하지 않았다.
> 최종 갱신: 2026-08-14

관련 문서: [scope.md](./scope.md) · [mvp-decisions.md](./mvp-decisions.md) · [implementation-plan.md](./implementation-plan.md)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260814000001_places.sql` | enum, `places`, 인덱스, 공개 조회 RLS |
| `supabase/migrations/20260814000002_profiles_and_submissions.sql` | `profiles`, (옛) `place_submissions`, RLS |
| `supabase/migrations/20260820115447_split_submissions.sql` | 제보를 `place_reports` · `place_edit_requests` 둘로 가름 |
| `supabase/migrations/20260820121425_place_photos_as_paths.sql` | `places.photos`를 절대 URL → 버킷 경로로 |
| `supabase/migrations/20260820121437_submission_photos_public.sql` | 제보 사진도 `place-images` 버킷으로, 컬럼명 `photos`로 통일 |
| `supabase/migrations/20260815000001_bookmarks.sql` | `bookmarks`, RLS |
| `supabase/migrations/20260814000003_seed_places.sql` | 카페 9곳 (`scripts/generate-seed.mjs`로 `data/cafes.json`에서 생성) |
| `supabase/migrations/20260814000004_places_photos.sql` | `places.photos` 추가 |
| `supabase/migrations/20260814100834_place_photos_from_storage.sql` | `place-images` 버킷 사진 9장을 `photos`에 연결 |
| `supabase/tests/` | 검증 스크립트 (auth 스텁 + 제약·RLS·제보 흐름 검사) |
| `scripts/verify-schema.sh` | 위 전부를 일회용 Postgres 컨테이너에서 실행 |

---

## 설계 원칙

**`data/cafes.json`의 필드 이름을 그대로 컬럼 이름으로 쓴다.** 이미 snake_case라서
`types/cafe.ts`의 `Cafe` 인터페이스가 그대로 row 모양이 된다. 덕분에 데이터 이음매
(`lib/cafes.ts`)를 갈아끼울 때 매핑 코드가 필요 없다:

```ts
export async function getCafes(): Promise<Cafe[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('status', 'published');
  if (error) throw error;
  return data;
}
```

컴포넌트는 그대로 두고 이 파일만 바꾸는 것이 애초에 이 구조를 열어둔 이유다 (CLAUDE.md).
**실제로 그렇게 했다** — 전환하면서 `components/`에서 바꾼 것은 `iced_americano_price`·
`naver_place_url`이 DB에서 nullable이라 `CafeCard`에 null 처리를 넣은 것뿐이다.

앱의 키는 `slug`다. `toCafe()`가 `slug`를 `Cafe.id`로 옮기고, slug가 없는 행(제보로
등록되어 아직 큐레이터가 slug를 붙이지 않은 경우)만 uuid로 버틴다.

**테이블 이름은 `places`, 앱 쪽은 여전히 `cafes`다.** 지금 담기는 것은 카페뿐이지만
스터디카페·도서관까지 넓힐 때 테이블을 다시 만들지 않으려고 일반적인 이름을 썼다.
앱 쪽 `data/cafes.json`·`lib/cafes.ts`·`types/cafe.ts`는 그대로 두었다 — 컬럼 이름이
`Cafe` 인터페이스와 일치하므로 바뀌는 것은 `.from('places')` 한 줄뿐이다.

제보는 **테이블 둘로 나뉜다** — `place_reports`(새 장소)와 `place_edit_requests`(정보 수정).
2026-08-20 이전에는 `place_submissions` 하나가 `kind`로 겸했다. 아래 UGC 절 참고.

---

## `places`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK | 제보로 들어오는 카페에도 즉시 부여 가능해야 하므로 uuid |
| `slug` | `text` unique, null 허용 | 기존 id(`naruteo` 등) 보존. URL 키 |
| `name` `address` `district` | `text` | `district`는 권역 확장 대비 (주소에서 추출) |
| `lat` `lng` | `double precision` | 한반도 범위 check |
| `naver_place_url` | `text` | 사진·상세 위임. **부분 unique 인덱스 = 중복 등록 방지 키** |
| `open_time` `close_time` | `text` + 정규식 check | `time`이 아니다 — 아래 참고 |
| `is_24h` | `boolean` | |
| `iced_americano_price` | `integer` | |
| `outlet` `noise` `work_fit` | enum | `types/cafe.ts`와 1:1 |
| `wifi` | `boolean` | |
| `work_policy` | enum, null | **보류 중인 결정.** 아래 참고 |
| `photos` | `text[]`, not null, 기본 `'{}'` | 사진 **URL** 목록. 파일은 저장하지 않는다. 아래 참고 |
| `tags` | `text[]` + GIN | 정규화(태그 테이블)는 현 규모에 과함 |
| `status` | enum `draft/published/hidden/closed` | 익명에게는 `published`만 보인다 |
| `last_verified` `verified_by` | `date` / `uuid` | 신선도 노출 (mvp-decisions 2-3) |
| `created_by` `created_at` `updated_at` | | `updated_at`은 트리거 |

### `photos` — 버킷 경로 하나로 통일

**카페와 관련된 이미지는 전부 `place-images` 버킷을 쓴다.** 외부 CDN 이미지는 화면에
얹지 않는다 — 카카오맵 응답 URL을 저장하지 않는다는 결정(크롤링 금지)과 저작권을
확인한 사진만 쓴다는 결정이 여기 걸려 있다.

컬럼에는 **경로만** 담는다.

```
photos = {naruteo.jpeg}
       ↑ https://<ref>.supabase.co/storage/v1/object/public/place-images/... 가 아니다
```

- 절대 URL을 담으면 **프로젝트 ref가 데이터에 박힌다.** 프로젝트를 옮기면 9행을 전부
  다시 써야 하고 그때까지 화면은 죽은 URL을 가리킨다. 다른 곳은 전부
  `NEXT_PUBLIC_SUPABASE_URL` 하나만 본다(`next.config.ts`의 remotePatterns까지).
- 공개 URL 조립은 앱의 `lib/place-images.ts` 한 곳에서만 한다. `toCafe()`가 그것을
  불러 `Cafe.photos`를 URL로 만들므로 컴포넌트는 버킷을 모른다.
- check 제약(`places_photos_paths`)이 `://`·공백·빈 문자열을 막는다. 배열을 **빈
  구분자로** 이어붙여 검사하는 이유는, 공백으로 이어붙이면 원소 안의 공백과 구분자를
  구별할 수 없기 때문이다(20260820122100).
- ⚠️ 지금 올라간 9장은 연습용 임시본이며 이용 권리를 확인하지 않았다. 공개 배포 전에
  직접 촬영본이나 사용 허가를 받은 사진으로 교체해야 한다.

경로가 곧 상태다.

| 경로 | 뜻 | 쓸 수 있는 주체 |
|---|---|---|
| `submissions/<uid>/<uuid>.jpg` | 검수 전 제보 사진 | 본인 (storage 정책) |
| `<slug>/<uuid>.jpg` | 승인된 카페 사진 | `service_role` 스크립트 |

DB에 적히는 모양은 테이블마다 다르다. `places.photos`는 위 경로를, 제보 두 테이블은
그 경로의 **공개 URL**을 담는다.

사진은 제출할 때 올라가고 insert가 그 뒤에 온다. 그 사이에 실패하면 앱이 방금 올린
파일을 그 자리에서 지우고(`removePhotos()`, 본인 폴더라 세션만으로 된다), 놓친 것은
`scripts/prune-orphan-photos.mjs`가 나중에 걷어간다.

### 판단이 갈렸던 지점

**시간을 `time`이 아니라 `text`로 둔다.** PostgREST는 `time`을 `"12:00:00"`으로
돌려주는데, 그러면 `formatBusinessHours()`가 `"12:00:00 - 21:30:00"`을 그린다.
`"HH:mm"` 문자열을 유지하면 `lib/openState.ts`가 손대지 않아도 그대로 돈다.
정규식 check로 형식은 DB에서 강제한다.

**요일별 영업시간은 아직 넣지 않았다.** 현재 모델은 "모든 요일 동일" 전제이고
`isOpenNow`도 그 위에 서 있다. 요일별로 가려면 `cafe_hours(place_id, weekday, open, close)`
테이블을 추가하고 `places`의 시간 컬럼을 버리는 마이그레이션이 필요하다 — 2차 이후.

**`places_published_requires_core` check.** `status='published'`인 행은
`outlet`·`wifi`·`noise`·`work_fit`·`last_verified`가 모두 채워져 있어야 한다.
"운영자가 직접 채워야 하는 핵심 자산"(scope.md)과 "신선도를 숨기지 않는다"를
DB 제약으로 박아둔 것이다. 속성이 빈 제보는 자동으로 `draft`에 머문다.

**`work_policy`는 enum 타입만 만들고 컬럼은 nullable.** scope.md 미확정 이슈 ②를
스키마가 대신 결정해 버리지 않게 하려는 것이다. 도입을 결정하면 컬럼은 이미 있으므로
9곳의 값을 채우고 필터를 붙이면 되고, 미도입으로 결론 나면 계속 null이면 된다.
**다만 이 초안이 이슈 ②를 해결한 것은 아니다 — 필터 UI 전에 여전히 결정해야 한다.**

**PostGIS는 넣지 않았다.** 9~100곳 규모에서 뷰포트 조회는 `(lat, lng)` B-tree
범위 조건으로 충분하다. "내 주변 N km" 정렬이 필요해지면 그때
`geography(Point,4326)` 생성 컬럼 + GiST로 옮긴다.

---

## `profiles` · 제보 두 테이블 (UGC)

- `profiles`: `auth.users` 미러. `role`은 `user/curator/admin`이고 가입 시 트리거로 자동 생성된다. 본인은 자기 `role`을 못 올린다.

### 왜 테이블이 둘인가

2026-08-20 이전에는 `place_submissions` 하나가 `kind`(`new`/`edit`/`closed`)로 셋을 겸했다.
문제는 **셋의 필수 항목이 서로 달랐다는 것**이다. 신규 제보에는 네이버 URL이, 수정
요청에는 대상 카페가 반드시 있어야 하는데 한 테이블에 두면 둘 다 nullable이 된다.
공통 컬럼이 `payload jsonb` 하나뿐이었던 것도 그래서다 — 무엇이 들어올 수 있는지가
스키마가 아니라 앱 코드에만 있었다.

| 테이블 | 담는 것 | not null |
|---|---|---|
| `place_reports` | 새 장소 제보 | `naver_place_url` |
| `place_edit_requests` | 기존 장소 수정 요청 | `place_id` |

공통점도 있다. 둘 다 `submitted_by`·`photos`·`note`·`status`·`reviewed_*`를 갖고,
RLS 정책과 "같은 사람이 같은 대상에 대기 중 요청 하나"(부분 unique 인덱스)도 같다.

- **`photos text[]`는 `place-images` 버킷의 공개 URL이다.** `places.photos`가 경로를
  담는 것과 다르다 — **검수자가 대시보드에서 값을 그대로 클릭해 사진을 열 수 있어야**
  하기 때문이다. 제보는 검수가 끝나면 수명이 끝나는 데이터라 URL에 프로젝트 ref가
  박히는 대가를 치를 만하다.
  check 제약이 `place-images` 공개 객체 URL 모양을 강제하므로 외부 CDN 이미지도,
  경로만 적은 값도 거부된다. 파일은 검수 전 `submissions/<uid>/` 아래에 있고, 승인되면
  같은 버킷의 `<slug>/`로 옮겨가면서 `places.photos`에는 **경로로** 붙는다.
- `place_reports.place_id`는 **승인된 뒤에만** 값을 갖는다. 대기 중에는 아직 카페가 없고
  (`place_reports_pending_has_no_place`), 승인은 곧 "이 카페로 등록했다"이므로 비어 있을
  수 없다(`place_reports_approved_has_place`).
- `place_edit_requests`에는 `has_content` 제약이 있다. 사진도 메모도 없는 요청은 검수하는
  사람이 열어봐야만 빈 것을 알 수 있다.
- **둘 다 `DELETE` 정책이 없다.** 보낸 사람이 지우면 검수 이력이 사라지고, 큐레이터에게는
  반려가 있다. 정책 없는 명령은 거부되므로 delete는 전부 막힌 상태다. 의도한 것이다.

### 승인 · 반려

**함수가 카페를 만들지도 고치지도 않는다.** 두 테이블 어느 쪽도 `places`를 채울 만큼의
정보를 담지 않기 때문이다. 옛 `approve_submission()`은 `jsonb_populate_record`로 payload를
`places`에 부었는데, 그 payload는 사실 운영자가 승인 직전에 손으로 채운 값이었다 —
사용자가 보내지 않은 것을 사용자가 보낸 것처럼 다루는 구조였다.

**사진이 붙은 제보는 스크립트로 승인한다.** 파일 이동은 Postgres가 못 하기 때문이다
(`storage.objects`의 name만 바꾸면 실제 오브젝트와 어긋난다).

```bash
node --env-file=.env.local scripts/approve-submission.mjs report <report-id> <place-id>
node --env-file=.env.local scripts/approve-submission.mjs edit   <request-id>
```

스크립트가 사진을 `<slug>/`로 옮기고 `places.photos`에 붙인 뒤 아래 함수를 부른다.
`SUPABASE_SERVICE_ROLE_KEY`가 필요하다.

```sql
-- 새 장소 제보: 큐레이터가 카페를 먼저 만들고, 그 카페에 제보를 연결한다
insert into public.places (name, address, lat, lng, is_24h, open_time, close_time,
                           naver_place_url, outlet, wifi, noise, work_fit,
                           status, last_verified, verified_by)
values ('...', '...', 37.5, 127.1, false, '10:00', '22:00',
        '<제보의 naver_place_url>', 'many', true, 'quiet', 'good',
        'published', current_date, auth.uid())
returning id;

select public.approve_place_report('<report id>', '<방금 만든 place id>');

-- 정보 수정 요청: places를 직접 고친 뒤
select public.approve_edit_request('<request id>');   -- last_verified를 오늘로 옮긴다
```

- `reject_place_report(uuid, text, uuid)` / `reject_edit_request(uuid, text, uuid)`: 반려 + 사유.
- 넷 다 `security definer`이고 `resolve_reviewer()`로 먼저 막는다. `authenticated`에만 grant.

**세 번째 인자(`p_reviewer`)가 있는 이유.** service_role 키의 JWT에는 `sub` 클레임이 없어
`auth.uid()`가 NULL이다. 파일 이동 때문에 운영 스크립트가 service_role로 도는데, 인자가
없으면 `is_curator(NULL)` = false라 **승인이 영영 통과하지 못한다.**

```sql
v_reviewer := coalesce(auth.uid(), case when auth.role() = 'service_role' then p_reviewer end);
```

순서가 방어선이다 — 세션이 있으면 무조건 그 사람이므로, 로그인한 비큐레이터가 인자에
큐레이터 uuid를 넣어도 자기 uid로 판정돼 막힌다. (`current_user`로는 판정할 수 없다.
`security definer` 안에서는 소유자로 바뀐다.)

---

## `bookmarks`

사용자가 저장한 장소. 2026-08-15에 들어왔다 (scope.md 변경 이력).

```
bookmarks (user_id, place_id, created_at)
primary key (user_id, place_id)
```

- **PK가 곧 중복 방지이자 조회 인덱스다.** 같은 카페를 두 번 저장하는 것을 PK가 막고,
  "내 북마크"(`user_id`로 시작하는 조회)가 같은 인덱스를 그대로 탄다. 별도 unique
  인덱스나 대리키 `id`를 두지 않았다.
- `place_id`에 별도 인덱스를 하나 더 걸었다. PK 순서상 `place_id` 단독 조회는 PK를
  못 타는데, `places` 삭제 시 cascade가 이 경로를 쓴다.
- **FK는 `places.id`(uuid)다. `slug`가 아니다.** 앱이 카페를 부르는 키는 slug지만
  `slug`는 nullable이라(제보로 등록돼 큐레이터가 아직 붙이지 않은 카페) 참조 무결성을
  주지 못한다. slug ↔ uuid 변환은 `lib/bookmarks.ts`가 맡는다.
- **소유자 컬럼 이름은 `user_id`다.** 이 저장소는 테이블마다 다르다 —
  `profiles.id`, `place_reports.submitted_by`, `bookmarks.user_id`.
- 저장해 둔 카페가 `draft`·`hidden`·`closed`로 바뀌면 `places` RLS가 그 행을 감춘다.
  목록에서는 빠지지만 북마크는 남는다. 다시 `published`가 되면 되살아난다.

### RLS 요약

| 대상 | anon | authenticated | curator/admin |
|---|---|---|---|
| `places` | `published`만 select | 동일 | 전체 select·insert·update |
| `profiles` | select | 본인 update (role 제외) | — |
| `place_reports` | 접근 불가 | 본인 것 insert·select, pending일 때 update | 전체 + 승인/반려 |
| `place_edit_requests` | 접근 불가 | 본인 것 insert·select, pending일 때 update | 전체 + 승인/반려 |
| `bookmarks` | 접근 불가 | 본인 것 select·insert·delete | 예외 없음 (본인 것만) |
| `place_reviews` | 접근 불가 (집계 함수만) | 본인 것 select·insert·update·delete | 예외 없음 (본인 것만) |
| `storage.objects` (`place-images`) | 공개 URL로 읽기 | `submissions/<본인 uid>/`에 insert·delete | 예외 없음 (스크립트는 `service_role`) |

카페 데이터 쓰기는 큐레이터 정책 또는 `service_role`(서버 전용 키)로만 가능하다.
`NEXT_PUBLIC_` anon 키로는 어떤 카페도 수정할 수 없다.

**`place_reviews`는 집계만 밖으로 나간다.** 테이블 자체는 본인 행만 보이고, 화면이 쓰는
"좋아요 3 · 보통 1 · 별로 0"은 `place_review_counts(uuid)` `security definer` 함수가 낸다
(`anon`·`authenticated`에 execute grant). 테이블을 열어 집계를 만들게 하면 누가 어디에
`bad`를 눌렀는지가 통째로 따라 나온다. **큐레이터도 남의 평가를 보지 못한다** — 운영에
필요한 정보가 아니다.

**`place_reviews`에는 `bookmarks`와 달리 `UPDATE` 정책이 있다.** 고칠 값(`value`)이 있기
때문이고, `using`과 `with check`를 함께 걸어 본인 행의 주인을 남에게 넘기지 못하게 막는다.

**버킷은 `place-images` 하나다.** 2026-08-20에 비공개 `submission-images`를 두었다가
같은 날 접었다 — 카페 이미지는 전부 한 버킷을 쓰고 컬럼 모양도 같아야 한다는 결정이다.
그 버킷을 만들던 마이그레이션(20260820113058)은 내용을 비워 두었다. **버킷 삭제 자체는
SQL로 못 한다** — `storage.protect_delete` 트리거가 storage 테이블 직접 삭제를 막으므로
대시보드나 Storage API를 쓴다.

- 대가: **검수 전 사진도 URL을 알면 열린다.** 파일명이 uuid라 추측은 어렵지만 인증이
  필요하지 않다는 뜻이다.
- 방어선 셋: 사용자는 `submissions/<본인 uid>/` 아래에만 쓸 수 있고(**카페 사진 자리
  `<slug>/`에는 직접 못 쓴다**), 버킷에 5MB·이미지 3종 제한이 있고, 폴더당 **20장 상한**을
  정책이 `submission_photo_count()`로 건다. 개수 상한이 빠져 있던 동안에는
  `MAX_PHOTOS = 5`가 클라이언트에만 있어 공개 버킷이 무한 업로드 대상이었다.
  세는 함수를 `security definer`로 둔 것은 SELECT 정책을 새로 열지 않으려는 것이다 —
  소유자(`postgres`)가 `bypassrls`라 정책과 무관하게 셀 수 있다.
- `SELECT` 정책은 만들지 않았다. 공개 버킷이라 읽기는 정책이 아니라 공개 URL로
  이뤄진다 — 정책을 만들면 통제하고 있다는 인상만 준다.
- `UPDATE` 정책도 없다(파일마다 새 uuid를 쓰므로 덮어쓸 일이 없다).
- **모든 정책에 `bucket_id` 조건이 함께 걸려 있다** — 빼면 모든 버킷에 적용된다.

⚠️ storage 마이그레이션에서 `alter table storage.objects enable row level security`와
`grant`를 쓰지 않는다. RLS는 이미 켜져 있고 `authenticated` grant도 이미 있으며,
`alter table`은 소유자(`supabase_storage_admin`)만 실행할 수 있어 거기서 깨진다.
`create policy`와 버킷 insert는 `postgres`로 통과한다 (2026-08-20 실측).

**`bookmarks`에는 `UPDATE` 정책이 없다. 일부러다.** 고칠 값이 없는 테이블이라
(`user_id`·`place_id`는 PK, `created_at`은 기록) 해제는 `delete`로 한다. 정책이 없는
명령은 거부되므로 update는 전부 막힌 상태이며, 이는 빠뜨린 것이 아니라 설계다.
**큐레이터도 남의 북마크를 보지 못한다** — 운영에 필요한 정보가 아니다.

---

## 적용 절차

```bash
supabase link --project-ref <ref>
supabase db push          # 스키마 + 카페 9곳 + 북마크
```

환경변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 추가로 필요하다
(`NEXT_PUBLIC_` 접두사이므로 개발 서버 재시작 필요).

---

## 검증

`./scripts/verify-schema.sh` — 일회용 `postgres:16-alpine` 컨테이너에 스텁 → 마이그레이션 →
검사를 순서대로 적용한다. Supabase 프로젝트 없이 돌아간다.

확인한 것:

| 항목 | 결과 |
|---|---|
| 마이그레이션 전체 적용, 카페 9곳 published 적재 | 통과 |
| anon은 `published`만 조회, 카페 추가 불가 | 통과 |
| `places_published_requires_core` (핵심 속성·확인일 없이 공개 불가) | 통과 |
| `places_hours_required`, 시간 정규식, 좌표 범위 | 통과 |
| `naver_place_url` 중복 등록 차단 | 통과 |
| 가입 시 `profiles` 자동 생성, 본인 `role` 승격 차단 | 통과 |
| 새 장소 제보 → 승인, 등록된 카페와 연결 (비큐레이터 승인 거부 포함) | 통과 |
| 수정 요청 → 승인, `last_verified`가 오늘로 이동 | 통과 |
| `photos`에 URL·공백 차단(`places`), 제보 쪽은 공개 URL 형식 강제, 내용 없는 수정 요청 차단 | 통과 |
| 비큐레이터 승인 거부 · service_role의 승인자 지정 · 로그인 사용자의 사칭 차단 | 통과 |
| 시드 9곳의 사진이 URL이 아니라 경로로 저장돼 있음 | 통과 |
| 제보 사진은 `submissions/<본인 uid>/`에만, 카페 사진 자리(`<slug>/`)에는 못 씀 | 통과 |
| 대기 중 요청은 대상당 하나 (부분 unique 인덱스) | 통과 |
| 남의 제보는 조회 불가, 남의 이름으로 제보 불가, 자가 승인 불가, delete 0건 | 통과 |
| `updated_at` 트리거, `"HH:mm"` 형식 유지 | 통과 |
| 북마크: 본인 것만 조회, anon은 0건, 큐레이터도 남의 것 못 봄 | 통과 |
| 북마크: 남의 uid로 insert 차단, 남의 행 delete 0건, 본인 것 delete 1건 | 통과 |
| 북마크: `update` 정책 부재 → 읽히는 행도 0건 갱신 | 통과 |
| 북마크: 같은 카페 중복 저장 차단 (PK) | 통과 |

검증 과정에서 실제로 하나 고쳤다: 승인 시 `place_id`를 되채우는 동작이
`kind='new'`는 대상이 없어야 한다는 제약과 충돌했다. 제약을 대기 중 상태로 한정해 해결했다.

북마크 검증에서도 하나 배웠다. **정책 없는 `UPDATE`는 예외를 던지지 않고 "해당 행 없음"이
된다.** `insufficient_privilege`를 기대한 테스트가 실패해서 알았다. `INSERT`의 `with check`
위반만 예외가 되고, `UPDATE`·`DELETE`는 조용히 0건이다. 그래서 그 검사는
"select로는 1건 보이는 상태에서 update는 0건"으로 적어야 의미가 생긴다.

**스텁의 한계.** `supabase/tests/00_stub_supabase.sql`은 `auth` 스키마와
`anon`/`authenticated` 역할을 흉내 낸 것이라, 실제 Supabase의 기본 grant·JWT 연동까지
검증하지는 못한다. 첫 `db push` 후 실제 프로젝트에서 다시 확인해야 한다.

---

## 남은 것

- ~~`data/cafes.json`과 DB 중 무엇이 원본인지~~ — **정해졌다. 런타임 원본은 DB다.** JSON은 시드 마이그레이션을 만드는 입력으로만 남는다. 이미 적용한 뒤 JSON을 고치면 새 마이그레이션을 따로 만들어야 한다.
- 즐겨찾기(`favorites`)는 scope.md대로 로컬스토리지로 두고 테이블을 만들지 않았다.
