-- ============================================================================
--  카공맵 — 브라우저에만 있던 규칙을 DB로 내린다
-- ----------------------------------------------------------------------------
--  런칭 전 보안 감사에서 나온 것들이다 (docs/security-audit-2026-08-23/README.md).
--
--  공통 원인이 하나다. **anon 키는 브라우저에 그대로 나가므로 `lib/submissions.ts`를
--  거치지 않고 PostgREST를 직접 부를 수 있다.** 그 파일에만 있던 규칙 셋
--  — 네이버 도메인, 사진 5장, 사진은 본인 것 — 이 DB에 없었다. 실측으로 확인했다:
--
--    insert into place_reports (naver_place_url, note)
--    values ('https://evil.example.com/phish', repeat('가', 50000));
--    → 통과했다
--
--  그 값은 /admin/reports에서 큐레이터가 클릭하는 링크로 렌더된다.
--
--  ⚠️ 여기서 거는 검사는 `lib/submissions.ts`의 검사를 **대체하지 않는다.**
--     그쪽은 파일을 고르는 즉시 이유를 말해 주기 위한 것이고, 이쪽은 막기 위한
--     것이다. 두 벌인 것이 중복이 아니라 역할이 다르다.
-- ============================================================================


-- ─── 1. profiles가 익명에게 전부 열려 있었다 ────────────────────────────────
--
--  `profiles_select_all`이 `to anon, authenticated using (true)`였다. anon 키로
--  `GET /rest/v1/profiles?select=*` 한 줄이면 전체 가입자 명부가 나온다 —
--  카카오 표시 이름, auth uid, 가입 시각, 그리고 **누가 큐레이터인지**까지.
--  사용자가 한 명인 지금은 티가 나지 않지만 런칭하는 순간 그대로 명부가 된다.
--
--  앱이 실제로 하는 profiles 조회는 둘뿐이고 둘 다 아래 정책으로 돈다.
--    * components/auth/AuthProvider.tsx — 본인 role
--    * lib/admin/reports.ts (attachSubmitters) — 큐레이터가 제보자 닉네임
--
--  anon을 대상에서 아예 뺀다. 로그아웃 상태에서 프로필을 읽을 화면이 없다.

drop policy "profiles_select_all" on public.profiles;

create policy "profiles_select_own_or_curator"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_curator((select auth.uid()))
  );

/**
 * 지금 로그인한 사람의 role.
 *
 * ⚠️ **이 함수가 없으면 위 정책이 profiles를 잠근다.** `profiles_update_own`의
 *    with check가 `select p.role from public.profiles p`로 자기 테이블을 읽는데,
 *    SELECT 정책이 `using (true)`인 동안에는 그 상수가 접혀서 넘어갔다. 정책이
 *    조건을 갖는 순간 UPDATE가 SELECT 정책을 펼치고, 그 안에서 다시 profiles를
 *    만나 `infinite recursion detected in policy for relation "profiles"`가 난다.
 *    (2026-08-23에 scripts/verify-schema.sh가 잡았다)
 *
 *    이것이 CLAUDE.md가 말하는 "정책 안에서 같은 테이블을 select하면 RLS가
 *    재귀한다"의 실제 사례다. `is_curator()`와 같은 처방을 쓴다 — security definer
 *    안에서는 소유자 권한이라 정책이 펼쳐지지 않는다.
 *
 * 인자를 받지 않는다. `profile_role(uuid)` 꼴로 두면 로그인한 사람이 남의 uuid로
 * role을 물어볼 수 있고, 그것은 방금 1번에서 막은 것과 같은 누출이다.
 * auth.uid()는 JWT 클레임 GUC라 정의자 컨텍스트에서도 호출자의 것이 보인다.
 */
create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_profile_role() is
  '지금 로그인한 사람의 role. profiles 정책이 자기 테이블을 select해 재귀하는 것을 막는다.';

revoke all    on function public.current_profile_role() from public, anon;
grant  execute on function public.current_profile_role() to authenticated;

-- role 승격은 본인이 못 한다. 판정 자체는 그대로이고 **읽는 방법만** 바뀐다.
drop policy "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = public.current_profile_role()
  );


-- ─── 2. 제보 URL이 네이버인지 DB가 보지 않았다 ──────────────────────────────
--
--  `isNaverPlaceUrl()`(lib/submissions.ts)은 host를 보는데 DB check는
--  `^https://\S+$`뿐이었다.
--
--  host 끝만 본다 — m.place.naver.com · map.naver.com · naver.me가 전부 유효하고,
--  경로 모양은 네이버가 바꿀 수 있어서 잡지 않는다. 앱 코드와 같은 판단이다.
--
--  ⚠️ 앱보다 **약간 엄격하다.** JS의 URL 파서는 `https://evil.com@naver.me/`의
--     hostname을 `naver.me`로 읽어 통과시키지만 이 정규식은 거부한다. 이 방향의
--     차이는 안전하다 — 통과해야 할 것을 막는 쪽이 아니라 그 반대다.

alter table public.place_reports
  drop constraint place_reports_naver_place_url_check;

alter table public.place_reports
  add constraint place_reports_naver_place_url_check
  check (naver_place_url ~* '^https://([a-z0-9-]+\.)*naver\.(com|me)([/?#][^[:space:]]*)?$');


-- ─── 3. UGC에 길이·개수 상한이 없었다 ───────────────────────────────────────
--
--  `note`는 맨 text였다. 5만 자가 그대로 들어갔다. 제보 행 수도 사실상 무제한이다 —
--  부분 unique 인덱스가 막는 것은 (submitted_by, naver_place_url) 조합이라 URL만
--  바꾸면 계속 쌓인다. 행 수 자체는 rate limit의 몫이라 여기서 다루지 않지만,
--  한 건의 크기는 여기서 묶는다.
--
--  2000자는 제보 폼의 메모로 넉넉하다. 그보다 긴 것은 설명이 아니라 다른 것이다.
--
--  사진 5장은 `MAX_PHOTOS`와 같은 값이다. storage의 20장 상한(submission_photo_count)이
--  파일 수는 막았지만 **배열에 담기는 개수**는 막지 않았다.

alter table public.place_reports
  add constraint place_reports_note_length
  check (note is null or char_length(note) <= 2000);

alter table public.place_reports
  add constraint place_reports_photos_count
  check (cardinality(photos) <= 5);

alter table public.place_edit_requests
  add constraint place_edit_requests_note_length
  check (note is null or char_length(note) <= 2000);

alter table public.place_edit_requests
  add constraint place_edit_requests_photos_count
  check (cardinality(photos) <= 5);


-- ─── 4. insert가 검수 컬럼을 막지 않았다 ────────────────────────────────────
--
--  with check가 `submitted_by`와 `status`만 봤다. reviewed_by · reviewed_at ·
--  review_note를 실어 보내면 그대로 들어간다. 상태가 pending이라 승인은 못 하지만
--  **검수 이력에 남의 이름을 박아 넣을 수 있었다.**
--
--  같은 자리에서 사진의 주인도 본다. 사진 URL은 공개 버킷을 가리키므로 남이 올린
--  것을 자기 제보에 담을 수 있었다 — `submissions/<본인 uid>/` 아래인지 확인한다.
--  storage 정책이 "쓸 수 있는 자리"를 정하듯 여기서는 "가리킬 수 있는 자리"를 정한다.
--
--  ⚠️ 승인된 사진은 `places.photos`로 옮겨 붙을 뿐 파일은 검수 폴더에 남는다
--     (20260821012109). 그래서 경로 접두사가 승인 뒤에도 그대로다.

/**
 * 이 사진들이 전부 이 사람의 검수 폴더를 가리키는가.
 *
 * 두 테이블이 같은 규칙을 쓰므로 함수 하나로 둔다. 정책마다 정규식을 복사하면
 * 한쪽만 고쳐지는 날이 온다 — 이 저장소가 `lib/place-images.ts`와 `lib/place-id.ts`를
 * 하나로 둔 것과 같은 이유다.
 *
 * security definer가 아니다. 인자만 보는 순수 함수라 정의자 권한이 필요 없다.
 */
create or replace function public.own_submission_photos(p_photos text[], p_uid uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
      from unnest(coalesce(p_photos, '{}'::text[])) as photo
     where photo not like
           '%/storage/v1/object/public/place-images/submissions/' || p_uid::text || '/%'
  );
$$;

comment on function public.own_submission_photos(text[], uuid) is
  '제보 사진이 전부 본인 검수 폴더(submissions/<uid>/)를 가리키는지. insert 정책이 쓴다.';

revoke all    on function public.own_submission_photos(text[], uuid) from public, anon;
grant  execute on function public.own_submission_photos(text[], uuid) to authenticated;

drop policy "place_reports_insert_own"       on public.place_reports;
drop policy "place_edit_requests_insert_own" on public.place_edit_requests;

create policy "place_reports_insert_own"
  on public.place_reports
  for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    -- 검수는 큐레이터가 승인·반려 RPC로만 남긴다. 보내는 쪽이 미리 채울 값이 아니다.
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
    and public.own_submission_photos(photos, (select auth.uid()))
  );

create policy "place_edit_requests_insert_own"
  on public.place_edit_requests
  for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
    and public.own_submission_photos(photos, (select auth.uid()))
  );


-- ─── 5. 익명에게 열려 있던 execute 회수 ─────────────────────────────────────
--
--  Supabase security advisor가 짚었다.
--
--   * is_curator(uuid) — **실질적이다.** 1번을 고쳐도 이 RPC로 "이 uuid가
--     큐레이터인가"를 로그인 없이 물어볼 수 있다. 두 경로를 같이 닫아야 의미가 있다.
--     정책 안에서는 계속 쓰인다 — 정책 여덟 개가 전부 `to authenticated`라
--     anon에서 회수해도 깨지지 않는다(확인함).
--   * handle_new_user() — 트리거 함수라 RPC로 부르면 "trigger functions can only be
--     called as triggers"로 죽는다. 실제 피해는 없지만 회수가 공짜고, 노출 목록에 남겨
--     두면 다음 감사에서 같은 줄을 또 읽게 된다. 트리거는 CREATE TRIGGER 시점에
--     권한을 보므로 회수해도 계속 돈다.
--
--  회수하지 않는 것: place_review_counts()는 로그아웃 상태의 상세 화면이 부르므로
--  anon에 열려 있어야 한다. 승인·반려 RPC는 authenticated에 열려 있지만 내부에서
--  resolve_reviewer()가 큐레이터를 확인한다. 둘 다 의도된 설계다.

revoke all on function public.is_curator(uuid)     from anon;
revoke all on function public.handle_new_user()    from public, anon, authenticated;
