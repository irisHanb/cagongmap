# 카공맵 런칭 전 보안 감사

- **감사일**: 2026-08-23
- **대상 커밋**: `8ea6968` (main)
- **범위**: 사용자 권한(인증·인가·RLS·관리자 경계) + 서비스 운영(키·rate limit·환경 분리·백업·사고 대응)
- **방식**: 코드·마이그레이션 정독 + Supabase security advisor + **실제 프로젝트에 anon/authenticated 역할로 붙어 실측**
- **제외**: 침투 테스트, 의존성 CVE 스캔, 카카오 OAuth 자체의 취약점

> 특정 시점 기록이다. `docs/seo-audit-2026-08-21/`과 같은 규칙으로 **갱신하지 않는다** —
> 다시 감사하면 새 폴더를 만든다.

---

## 요약

관리자 경계는 이 규모에서 보기 드물게 잘 잡혀 있다. 서버 액션과 조회 함수마다
`requireCurator()`가 이중으로 걸려 있고, `getSession()`이 아니라 `getUser()`를 쓰고,
service_role 키가 앱에 없다.

**실제 구멍은 관리자 쪽이 아니라 "일반 사용자가 anon 키로 PostgREST를 직접 호출하는
경로"에 몰려 있다.** 브라우저 코드에만 있고 DB에는 없는 규칙이 셋이다.

그리고 **RLS 회귀 테스트가 실패할 수 없는 구조다.** 개별 구멍보다 이쪽이 더 크다.

| 등급 | 건수 | 항목 |
|---|---:|---|
| 🔴 High | 3 | H1 profiles 전체 공개 · H2 제보 URL 검증 부재 · H3 UGC 상한 부재 |
| 🟡 Medium | 5 | M1 검수 컬럼 위조 · M2 JSON-LD 이스케이프 · M3 환경 미분리 · M4 rate limit 부재 · M5 백업·대응 부재 |
| 🟢 확인됨 | — | 관리자 인가, mass assignment, storage 격리, 키 관리 |

---

## 1. 관측된 사실

실제 프로젝트에 직접 붙어 확인한 값만 적는다.

### anon 역할로 `public.profiles` 조회

```sql
set local role anon;
select id, nickname, role, created_at from public.profiles limit 10;
```

```
id                                    | nickname | role    | created_at
3e339f8f-cee8-45e7-a506-655079dad4dc  | hanb     | curator | 2026-08-15 09:34:13+00
```

**1행 반환.** 0행이어야 한다.

### authenticated 역할로 제보 insert (트랜잭션 안, rollback)

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"3e33...4dc","role":"authenticated"}';
insert into public.place_reports (naver_place_url, note)
values ('https://evil.example.com/phish', repeat('가', 50000))
returning id, char_length(note);
rollback;
```

```
id                                   | note_len
4f8d7795-4acd-4bd1-90ee-9d0e85d38de4 | 50000
```

**둘 다 통과했다.** 네이버가 아닌 도메인, 5만 자 note. rollback 뒤 잔여 행 0건 확인.

> ⚠️ 계정이 하나뿐이라 큐레이터 uid로 넣었다. 일반 사용자도 통과한다는 것은
> 정책·제약 텍스트로 내린 결론이다 — `place_reports_insert_own`의 with check와
> `place_reports_naver_place_url_check` 어디에도 도메인·길이 조건이 없다.

### 관련 제약 원문

```
place_reports_naver_place_url_check : CHECK (naver_place_url ~ '^https://\S+$')
place_reports_photos_urls           : (place-images 공개 URL 모양만 검사, 개수 무관)
place_edit_requests_has_content     : (사진 또는 note 존재 여부만 검사, 길이 무관)
```

`note` 컬럼에 check 없음. `photos` 배열에 cardinality 상한 없음.

### Supabase security advisor

| 항목 | 판정 |
|---|---|
| `handle_new_user()` anon/authenticated execute 가능 | 트리거 함수라 RPC 호출은 실패한다. revoke가 공짜라 닫는다 |
| `is_curator(uuid)` anon execute 가능 | **실질적이다.** H1을 고쳐도 이 경로로 role 조회가 남는다 |
| `place_review_counts()` anon execute 가능 | **의도된 설계다.** 로그아웃 상태에서도 집계가 필요하다 |
| 승인·반려 RPC authenticated execute 가능 | **의도된 설계다.** 내부에서 `resolve_reviewer()`가 큐레이터를 확인한다 |
| `rls_auto_enable()` | Supabase 플랫폼 함수. 우리 것이 아니고 event_trigger라 호출 불가 |
| `set_updated_at` search_path 미설정 | security **invoker**라 위험이 낮다 |
| leaked password protection 비활성 | 카카오 OAuth만 쓰므로 해당 없다 |

---

## 2. 사용자 권한 관점

### 🔴 H1. `profiles`가 익명에게 전부 열려 있다

`20260814000002_profiles_and_submissions.sql`의 정책이 원인이다.

```sql
create policy "profiles_select_all"
  on public.profiles for select
  to anon, authenticated
  using (true);
```

anon 키는 브라우저에 그대로 나간다. 런칭해서 사용자가 붙는 순간
`GET /rest/v1/profiles?select=*` 한 줄이 **전체 가입자 명부**가 된다 — 카카오 표시
이름, auth uid, 가입 시각, 그리고 **누가 큐레이터인지**까지.

앱이 실제로 필요로 하는 조회는 둘뿐이다.

| 호출처 | 읽는 것 |
|---|---|
| `components/auth/AuthProvider.tsx:139` | 본인 role |
| `lib/admin/reports.ts:64` (`attachSubmitters`) | 큐레이터가 제보자 닉네임 |

`id = (select auth.uid()) or public.is_curator((select auth.uid()))`로 좁히면 둘 다
그대로 돈다.

### 🔴 H2. 제보 URL의 네이버 도메인 검사가 브라우저에만 있다

`isNaverPlaceUrl()`(`lib/submissions.ts:70`)이 host를 보지만 DB는 `^https://\S+$`만
본다. 정책의 with check도 `submitted_by`·`status`만 본다.

그 값은 `/admin/reports`의 `ReportDialog.tsx:112`에서 `target="_blank"` 링크로
렌더된다. **큐레이터를 겨냥한 피싱 링크 투입 경로다.**

### 🔴 H3. UGC에 길이·개수 상한이 DB에 없다

- `note`는 맨 `text`다. 5만 자가 들어갔다.
- 제보 행 수가 사실상 무제한이다. 부분 unique 인덱스가 막는 것은
  `(submitted_by, naver_place_url)` 조합이라 URL만 바꾸면 계속 쌓인다.
- `MAX_PHOTOS = 5`는 `lib/submissions.ts`에만 있다. DB에 cardinality 상한이 없다.
- storage 20장 상한(`submission_photo_count`)이 파일 수는 막지만, **남이 올린 사진
  URL을 배열에 담는 것**은 막지 않는다 — check는 공개 URL 모양만 본다.

### 🟡 M1. 제보 insert가 검수 컬럼을 막지 않는다

두 insert 정책의 with check가 `submitted_by`와 `status`만 본다. `reviewed_by` ·
`reviewed_at` · `review_note`를 실어 보내면 그대로 들어간다. 상태가 `pending`이라
승인은 못 하지만 **검수 이력에 남의 이름을 박아 넣을 수 있다.**

`place_id`는 `place_reports_pending_has_no_place` check가 막아 준다.

### 🟡 M2. JSON-LD가 `</script>`를 이스케이프하지 않는다

`app/page.tsx:19`와 `app/cafes/page.tsx:42`가 `JSON.stringify()` 결과를
`dangerouslySetInnerHTML`로 넣는다. 카페 이름에 `</script><script>`가 들어가면
그대로 빠져나간다.

데이터가 큐레이터 입력이라 지금 당장 뚫리지는 않는다. **한 줄이면 닫히는 구멍이라
남겨둘 이유가 없다.**

### 🟢 확인된 것 — 건드리지 않는다

- 서버 액션과 `lib/admin/*` 조회 함수마다 `requireCurator()` 이중 판정. RLS 하나에
  기대지 않는다.
- 페이지마다 `guardAdminPage()`. 레이아웃 가드만으로는 RSC 페이로드가 404 응답에
  실린다는 것을 2026-08-21에 실측으로 잡아 고친 흔적이 있다.
- `buildPlacePayload()`가 컬럼을 명시적으로 화이트리스트한다. **요청 body를 통째로
  반영하는 경로가 없다.**
- `bookmarks`·`place_reviews`가 네 명령 다 설계돼 있다. 리뷰 집계를
  `place_review_counts()` RPC로만 노출하고 **큐레이터도 원본을 못 본다.**
- `getUser()` 사용, PKCE 서버 교환, 보안 헤더 4종, storage 경로 격리
  (`submissions/<uid>/` vs `<slug>/`).

---

## 3. 서비스 운영 관점

### 🟡 M3. 운영과 로컬이 같은 Supabase 프로젝트다

`.env.local`이 실서비스 프로젝트를 가리킨다. 로컬 `npm run dev`가 **운영 DB와 운영
storage에 쓴다.** 마이그레이션 실수 하나가 곧 운영 사고다.

`scripts/verify-schema.sh`가 일회용 컨테이너를 쓰는 것은 좋지만, 그것은 스키마
검증이지 앱 실행 환경이 아니다.

### 🟡 M4. rate limit과 상한이 어디에도 없다

- Next 쪽 rate limit 0. 서버 액션도 제보 insert도 무제한이다.
- **AI 호출은 없다.** 이 항목은 해당 없음.
- storage: 사용자당 20장 × 5MB = 100MB. **사용자 수에는 상한이 없다.**
- 카카오맵 JS 키는 `NEXT_PUBLIC_`이라 공개가 전제다. 유일한 방어선이 콘솔의 플랫폼
  도메인 등록이고, **배포 도메인은 이미 등록돼 있다** — `cagongmap-nu.vercel.app`에서
  fallback 문구 없이 지도가 렌더되는 것을 2026-08-21에 확인했다
  (`docs/seo-audit-2026-08-21/seo-visual.md`). 커스텀 도메인으로 옮길 때만 다시 볼 일이다.

  > 초판에 "등록된 것은 localhost 하나"라고 적었던 것은 틀렸다. `.env.example`의
  > **로컬 개발용 안내 주석**을 등록 목록으로 읽은 것이고, 콘솔을 보지도 같은
  > 저장소의 기존 확인 기록을 찾아보지도 않은 채 단정했다.

### 🟡 M5. 백업·사고 대응·이상 감지가 전부 없다

| 항목 | 현재 |
|---|---|
| 백업 | Supabase 무료 플랜에 PITR 없음. **되돌릴 지점이 없다** |
| 키 재발급 | 절차 없음. anon 키를 갈면 재배포가 필요하고 그동안 서비스가 멈춘다 |
| 기능 잠금 | 스위치 없음. 제보 스팸이 들어와도 끄는 방법이 마이그레이션뿐이다 |
| 이상 감지 | 없음. 누가 5만 자 note를 만 건 넣어도 알 방법이 없다 |

### 🟢 CSP는 의도적으로 뺀 결정

`next.config.ts:29`에 카카오 SDK·Supabase·next/image가 얽혀 있어 어설픈 CSP가 지도를
깨뜨린다는 근거가 적혀 있다. 지금 단계에서 타당하다. 다만 "없다"는 사실은 위험
목록에 남는다.

### 🟢 키 관리

`SUPABASE_SERVICE_ROLE_KEY`가 `scripts/prune-orphan-photos.mjs` 한 곳에만 있고 앱에는
없다. `.gitignore`가 `.env*`를 막고, git에 올라간 것은 `.env.example`뿐이다.

---

## 4. 테스트 관점 — 가장 중요한 발견

`supabase/tests/20_rls_checks.sql`의 **절반이 단언하지 않는다.**

```sql
select count(*) as reports_visible_to_anon from public.place_reports;   -- 출력만 한다
select count(*) as visible_to_anon         from public.bookmarks;        -- 출력만 한다
select count(*) as others_deleted          from gone;                    -- 출력만 한다
```

`do $$ ... raise exception 'FAIL' $$` 형태만 실제 검사다. 나머지는 값이 무엇이 나오든
`psql` exit 0이고 `./scripts/verify-schema.sh`는 ✅를 찍는다.

**RLS 정책을 통째로 지워도 이 스위트는 통과한다.** 새 테스트를 붙이기 전에 기존 count
검사부터 단언으로 바꿔야 나머지가 의미를 갖는다.

### 지금 넣으면 빨간불이 되는 테스트

> 아래 다섯은 감사 당일 `20_rls_checks.sql`의 J절로 들어갔고, 기존 26곳의
> `select count(*)`도 전부 단언으로 바뀌었다. 부록 참고.

| # | 테스트 | 지금 결과 | 잡는 것 |
|---|---|---|---|
| 1 | anon으로 `profiles` 조회 → 0행이어야 한다 | **1행** (실측) | H1 |
| 2 | `naver_place_url = 'https://evil.example.com/phish'` insert → 거부 | **성공** (실측) | H2 |
| 3 | `note = repeat('가', 50000)` insert → 거부 | **성공** (실측) | H3 |
| 4 | `photos` 6장짜리 insert → 거부 | **성공** | H3 |
| 5 | `reviewed_by`를 실은 insert → 거부 | **성공** | M1 |

회귀 방지용으로 하나 더: `submission_photo_count` 20장 상한을 넘는 21번째 업로드가
막히는지. 정책에는 있는데 테스트가 없다.

---

## 5. 바로 고칠 것 (결정이 필요 없는 것)

마이그레이션 한 장 + 코드 한 줄 수준이다.

1. `profiles_select_all`을 **본인 + 큐레이터**로 좁힌다 — 두 호출처 다 그대로 돈다.
2. `place_reports.naver_place_url`에 **네이버 host check**를 건다.
3. `note`에 `char_length <= 2000`, `photos`에 `cardinality <= 5` check.
4. 두 insert 정책의 with check에 `reviewed_by/reviewed_at/review_note is null` 추가.
5. `is_curator(uuid)`와 `handle_new_user()`의 **anon execute 회수.**
6. JSON-LD에서 `<` → `\u003c` 치환 (`lib/schema.ts`).
7. `20_rls_checks.sql`의 `select count(*)`들을 **단언으로** 바꾼다 — 이것이 1~6번을
   지켜 준다.

**의도적으로 손대지 않는 것**: `places` mass assignment, 관리자 액션 인가, storage
경로 격리, `place_review_counts()`·승인 RPC의 grant. 전부 이미 맞다.

## 6. 사람이 결정할 것

| 항목 | 물어야 할 것 |
|---|---|
| 운영/로컬 분리 | 프로젝트를 하나 더 팔지, 습작이니 감수할지. 감수한다면 그 사실을 `mvp-decisions.md`에 못박는 것이 맞다 |
| 카카오맵 키 | **결정할 것이 없다.** 배포 도메인은 이미 등록돼 있다. 커스텀 도메인으로 옮기는 날 다시 본다 |
| rate limit | Vercel 쪽 · Supabase 쪽 · "첫 사용자가 몇 명뿐이니 두지 않는다"를 명시적 결정으로 남기기. **지금은 결정이 아니라 공백이다** |
| 백업 | 유료 전환 · `pg_dump` 수동 백업 · "잃어도 되는 데이터"로 규정 |
| 사고 대응 | 키 재발급 절차와 "제보만 끄는" 스위치가 필요한지. 필요하면 insert 정책을 뒤집는 마이그레이션 한 장을 **미리** 준비해두는 것이 가장 싸다 |
| 이상 감지 | 최소한 무엇을 볼지 — 제보 급증 · storage 사용량 · 로그인 실패 |
| `promote_curator`의 하드코딩 uuid | 저장소에 개인 auth uid가 커밋돼 있다. 공개 저장소로 갈 계획이 있는지에 달렸다 |
| 사진 이용 권리 | 이미 `mvp-decisions.md`의 미결 항목인데 런칭 전 결정 목록에 그대로 남아 있다 |

---

## 부록 — 처리 결과 (2026-08-23)

5절 일곱 항목은 감사 당일 전부 반영했다. **6절은 열린 채로 남는다.**

| # | 어디에 |
|---|---|
| 1 · 2 · 3 · 4 | `supabase/migrations/20260823034122_tighten_ugc_and_profiles.sql` |
| 5 | 위 파일 + `20260823034319_revoke_is_curator_from_public.sql` |
| 6 | `lib/schema.ts`의 `jsonLdText()` — `app/page.tsx`·`app/cafes/page.tsx`가 쓴다 |
| 7 | `supabase/tests/20_rls_checks.sql` (기존 26곳 단언화 + J·K·L 절) |

문서도 함께 고쳤다 — `docs/db-schema.md`의 "RLS 요약" 표와 그 아래 설명.

### 고치는 과정에서 나온 것 둘

기록해 두는 이유는 **둘 다 "고친 줄 알았는데 아니었던" 종류**이기 때문이다.

**① `profiles`를 잠그니 RLS가 재귀했다.**
`profiles_update_own`의 with check가 `select p.role from public.profiles p`로 자기
테이블을 읽고 있었다. SELECT 정책이 `using (true)`인 동안에는 그 상수가 접혀서
넘어갔지만, 정책이 조건을 갖는 순간 `infinite recursion detected in policy for
relation "profiles"`가 났다. `public.current_profile_role()`(security definer)로 뺐다.

CLAUDE.md가 "정책 안에서 같은 테이블을 select하면 RLS가 재귀한다"고 이미 적어 둔
바로 그 함정인데, `profiles_update_own`만 예외로 남아 있었다. **`scripts/verify-schema.sh`가
잡았다** — 실제 프로젝트에 먼저 적용했다면 로그인한 사용자의 프로필 갱신이 통째로
깨진 채 배포됐을 것이다.

**② `revoke ... from anon`이 아무 일도 하지 않았다.**
함수의 `EXECUTE`는 만들어질 때 `PUBLIC`에 붙고 `anon`은 그것을 상속한다. `anon`에게
따로 준 적이 없으니 `anon`에서 회수할 것도 없다. 적용한 뒤 advisor에 `is_curator`가
그대로 남아 있어서 알았고, `from public, anon` + `grant to authenticated`로 고쳤다
(`20260823034319`). 같은 마이그레이션의 `handle_new_user`는 `from public, ...`이라
제대로 빠졌었다.

### 적용 뒤 확인

| 확인 | 결과 |
|---|---|
| anon으로 `select count(*) from profiles` | **0** (감사 시점 1) |
| 큐레이터 세션으로 본인 profile · 제보 목록 | 1 · 4 — 그대로 돈다 |
| `./scripts/verify-schema.sh` | ✅ 통과 (J·K·L 절 포함) |
| 마이그레이션을 빼고 재실행 | `FAIL: anon에게 profiles가 보이지 않는다 — 기대 0, 실제 2` |
| `npm run verify` | lint · typecheck · 119 tests 통과 |
| Supabase security advisor (anon 노출) | `place_review_counts`(의도) + `rls_auto_enable`(플랫폼 함수)만 남음 |

`is_curator` · `handle_new_user` · `set_updated_at`은 advisor 목록에서 빠졌다.
