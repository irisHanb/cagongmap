# DB 스키마 초안 (Supabase / Postgres)

> 상태: **초안**. 로컬 Postgres 16에서 검증했으나 아직 어떤 Supabase 프로젝트에도 적용하지 않았다.
> 최종 갱신: 2026-08-14

관련 문서: [scope.md](./scope.md) · [mvp-decisions.md](./mvp-decisions.md) · [implementation-plan.md](./implementation-plan.md)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260814000001_places.sql` | enum, `places`, 인덱스, 공개 조회 RLS |
| `supabase/migrations/20260814000002_profiles_and_submissions.sql` | `profiles`, `place_submissions`, 승인/반려 함수, RLS |
| `supabase/migrations/20260814000003_seed_places.sql` | 카페 9곳 (`scripts/generate-seed.mjs`로 `data/cafes.json`에서 생성) |
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

신고는 별도 테이블 없이 `place_submissions`의 `kind='closed'`로 처리한다. 폐업 신고와
정보 수정 제보는 검수 흐름이 같아서 테이블을 나눌 이유가 없었다.

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
| `tags` | `text[]` + GIN | 정규화(태그 테이블)는 현 규모에 과함 |
| `status` | enum `draft/published/hidden/closed` | 익명에게는 `published`만 보인다 |
| `last_verified` `verified_by` | `date` / `uuid` | 신선도 노출 (mvp-decisions 2-3) |
| `created_by` `created_at` `updated_at` | | `updated_at`은 트리거 |

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

## `profiles` · `place_submissions` (UGC)

1차 범위 밖이지만(scope.md), 나중에 붙일 자리를 미리 파둔 것이다. **이 테이블들이
비어 있어도 조회 전용 1차 구현은 그대로 동작한다.**

- `profiles`: `auth.users` 미러. `role`은 `user/curator/admin`이고 가입 시 트리거로 자동 생성된다. 본인은 자기 `role`을 못 올린다.
- `place_submissions`: 제보 한 건. `kind`는 `new`(신규) / `edit`(수정) / `closed`(폐업 신고).
  - **제안 값은 `payload jsonb`에 담는다.** `places`의 15개 컬럼을 nullable로 복제하면 두 스키마가 반드시 어긋난다. 대신 `id`·`status`·`created_by` 같은 키는 check 제약으로 payload에서 금지했다.
  - 같은 사람이 같은 카페에 대기 중 제보를 중복으로 쌓지 못하게 부분 unique 인덱스를 걸었다.
  - `kind='new'`는 **대기 중일 때만** 대상 카페가 없다. 승인되면 그때 생성된 카페를 가리키도록 `place_id`를 채우므로, 제약을 "대기 중"으로 한정했다.
- `approve_submission(uuid)`: 반영과 상태 변경을 한 트랜잭션에서 처리한다. `jsonb_populate_record`로 기존 행 위에 payload를 덮으므로 부분 수정이 자연스럽게 된다. **승인 = 운영자가 확인한 것**이므로 `last_verified`를 오늘로 갱신한다.
- `reject_submission(uuid, text)`: 반려 + 사유.

### RLS 요약

| 대상 | anon | authenticated | curator/admin |
|---|---|---|---|
| `places` | `published`만 select | 동일 | 전체 select·insert·update |
| `profiles` | select | 본인 update (role 제외) | — |
| `place_submissions` | 접근 불가 | 본인 것 insert·select, pending일 때 update | 전체 + 승인/반려 |

카페 데이터 쓰기는 큐레이터 정책 또는 `service_role`(서버 전용 키)로만 가능하다.
`NEXT_PUBLIC_` anon 키로는 어떤 카페도 수정할 수 없다.

---

## 적용 절차

```bash
supabase link --project-ref <ref>
supabase db push          # 마이그레이션 3개 — 스키마 2개 + 카페 9곳
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
| 마이그레이션 3개 적용, 카페 9곳 published 적재 | 통과 |
| anon은 `published`만 조회, 카페 추가 불가 | 통과 |
| `places_published_requires_core` (핵심 속성·확인일 없이 공개 불가) | 통과 |
| `places_hours_required`, 시간 정규식, 좌표 범위 | 통과 |
| `naver_place_url` 중복 등록 차단 | 통과 |
| 가입 시 `profiles` 자동 생성, 본인 `role` 승격 차단 | 통과 |
| 제보 신규 등록 → 승인 (비큐레이터 승인 거부 포함) | 통과 |
| 제보 부분 수정 (payload에 있는 키만 반영) | 통과 |
| payload 금지 키 차단, 반려 흐름 | 통과 |
| 남의 제보는 조회 불가, 큐레이터는 전체 조회 | 통과 |
| `updated_at` 트리거, `"HH:mm"` 형식 유지 | 통과 |

검증 과정에서 실제로 하나 고쳤다: 승인 시 `place_id`를 되채우는 동작이
`kind='new'`는 대상이 없어야 한다는 제약과 충돌했다. 제약을 대기 중 상태로 한정해 해결했다.

**스텁의 한계.** `supabase/tests/00_stub_supabase.sql`은 `auth` 스키마와
`anon`/`authenticated` 역할을 흉내 낸 것이라, 실제 Supabase의 기본 grant·JWT 연동까지
검증하지는 못한다. 첫 `db push` 후 실제 프로젝트에서 다시 확인해야 한다.

---

## 남은 것

- ~~`data/cafes.json`과 DB 중 무엇이 원본인지~~ — **정해졌다. 런타임 원본은 DB다.** JSON은 시드 마이그레이션을 만드는 입력으로만 남는다. 이미 적용한 뒤 JSON을 고치면 새 마이그레이션을 따로 만들어야 한다.
- 즐겨찾기(`favorites`)는 scope.md대로 로컬스토리지로 두고 테이블을 만들지 않았다.
