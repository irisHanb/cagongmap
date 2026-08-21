-- ============================================================================
--  카공맵 — 승인 경로를 실제로 돌게 고치고, 업로드 개수를 서버에서 막는다
-- ----------------------------------------------------------------------------
--  코드 리뷰에서 나온 두 가지를 잡는다.
--
--  ── 1. 승인 함수가 service_role로는 절대 통과하지 못했다 ───────────────────
--  네 함수 모두 `is_curator(auth.uid())`로 막는데, service_role 키의 JWT에는 `sub`
--  클레임이 없다. 그래서 auth.uid()가 NULL이 되고 is_curator(NULL)은 false다.
--  파일을 옮기는 것은 Storage API를 거쳐야 해서 운영 스크립트가 service_role로 도는데,
--  **그 스크립트가 부르는 승인은 한 번도 성공할 수 없었다.**
--
--  세션이 있으면 그 사람이 승인자다. 세션이 없고 호출자가 service_role일 때만
--  누구로 승인하는지를 인자로 받는다. 이 순서가 중요하다 — coalesce가 auth.uid()를
--  먼저 보므로, 로그인한 비큐레이터가 p_reviewer에 큐레이터 uuid를 넣어도 자기
--  uid로 판정돼 막힌다.
--
--  ── 2. 사진 개수 제한이 클라이언트에만 있었다 ─────────────────────────────
--  MAX_PHOTOS = 5는 lib/submissions.ts에만 있고 anon 키는 브라우저에 그대로 나간다.
--  즉 로그인한 사람이 공개 버킷의 자기 폴더에 5MB짜리를 무한정 넣을 수 있었다.
--  버킷의 크기·형식 제한은 **한 파일**만 묶지 개수를 막지 않는다 — 20260820121437의
--  "이 결정의 방어선" 주석은 그 점에서 과장이었다.
-- ============================================================================


-- ─── 1. 승인자 판정 ─────────────────────────────────────────────────────────

/**
 * 이 요청을 누구의 이름으로 처리할지 정한다. 큐레이터가 아니면 예외.
 *
 * security definer지만 auth.uid()·auth.role()은 JWT 클레임 GUC를 읽으므로 정의자
 * 컨텍스트에서도 호출자의 것이 그대로 보인다. (current_user는 그렇지 않다 —
 * 정의자 함수 안에서는 소유자로 바뀌므로 역할 판정에 쓰면 안 된다)
 */
create or replace function public.resolve_reviewer(p_reviewer uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reviewer uuid;
begin
  v_reviewer := coalesce(
    auth.uid(),
    -- 세션이 없을 때만 인자를 본다. service_role 키는 서버 전용이다.
    case when auth.role() = 'service_role' then p_reviewer end
  );

  if v_reviewer is null or not public.is_curator(v_reviewer) then
    raise exception '큐레이터만 제보를 처리할 수 있습니다';
  end if;

  return v_reviewer;
end;
$$;

comment on function public.resolve_reviewer(uuid) is
  '승인·반려의 주체를 정한다. 세션이 있으면 그 사람, service_role일 때만 인자를 쓴다.';

-- 인자가 하나 늘었으므로 옛 시그니처를 지운다. 남겨 두면 2인자 호출이 계속 옛
-- 함수(=절대 통과 못 하는 쪽)로 붙는다.
drop function if exists public.approve_place_report(uuid, uuid);
drop function if exists public.approve_edit_request(uuid);
drop function if exists public.reject_place_report(uuid, text);
drop function if exists public.reject_edit_request(uuid, text);

create or replace function public.approve_place_report(
  p_report_id uuid,
  p_place_id  uuid,
  p_reviewer  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
  v_status   public.submission_status;
begin
  select status into v_status
    from public.place_reports
   where id = p_report_id
     for update;

  if not found then
    raise exception '제보를 찾을 수 없습니다: %', p_report_id;
  end if;
  if v_status <> 'pending' then
    raise exception '이미 처리된 제보입니다 (status=%)', v_status;
  end if;
  if not exists (select 1 from public.places where id = p_place_id) then
    raise exception '연결할 카페를 찾을 수 없습니다: %', p_place_id;
  end if;

  update public.place_reports
     set status      = 'approved',
         place_id    = p_place_id,
         reviewed_by = v_reviewer,
         reviewed_at = now()
   where id = p_report_id;
end;
$$;

comment on function public.approve_place_report(uuid, uuid, uuid) is
  '제보를 승인하고 큐레이터가 만든 카페에 연결한다. 카페 생성 자체는 하지 않는다.';

create or replace function public.approve_edit_request(
  p_request_id uuid,
  p_reviewer   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
  r          public.place_edit_requests;
begin
  select * into r
    from public.place_edit_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception '수정 요청을 찾을 수 없습니다: %', p_request_id;
  end if;
  if r.status <> 'pending' then
    raise exception '이미 처리된 요청입니다 (status=%)', r.status;
  end if;

  -- 요청에는 자유 메모와 사진뿐이라 자동으로 반영할 구조화된 값이 없다. 실제 수정은
  -- 큐레이터가 places를 직접 고치는 것이고, 여기서는 "사람이 다시 봤다"만 기록한다.
  update public.places
     set last_verified = current_date,
         verified_by   = v_reviewer
   where id = r.place_id;

  update public.place_edit_requests
     set status      = 'approved',
         reviewed_by = v_reviewer,
         reviewed_at = now()
   where id = p_request_id;
end;
$$;

create or replace function public.reject_place_report(
  p_report_id uuid,
  p_reason    text default null,
  p_reviewer  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
begin
  update public.place_reports
     set status      = 'rejected',
         reviewed_by = v_reviewer,
         reviewed_at = now(),
         review_note = p_reason
   where id = p_report_id
     and status = 'pending';
end;
$$;

create or replace function public.reject_edit_request(
  p_request_id uuid,
  p_reason     text default null,
  p_reviewer   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
begin
  update public.place_edit_requests
     set status      = 'rejected',
         reviewed_by = v_reviewer,
         reviewed_at = now(),
         review_note = p_reason
   where id = p_request_id
     and status = 'pending';
end;
$$;

revoke all    on function public.resolve_reviewer(uuid)                 from public, anon;
revoke all    on function public.approve_place_report(uuid, uuid, uuid) from public, anon;
revoke all    on function public.approve_edit_request(uuid, uuid)       from public, anon;
revoke all    on function public.reject_place_report(uuid, text, uuid)  from public, anon;
revoke all    on function public.reject_edit_request(uuid, text, uuid)  from public, anon;
grant  execute on function public.approve_place_report(uuid, uuid, uuid) to authenticated;
grant  execute on function public.approve_edit_request(uuid, uuid)       to authenticated;
grant  execute on function public.reject_place_report(uuid, text, uuid)  to authenticated;
grant  execute on function public.reject_edit_request(uuid, text, uuid)  to authenticated;


-- ─── 2. 업로드 개수 상한 ────────────────────────────────────────────────────

/**
 * 검수 전 폴더(`submissions/<uid>/`)에 이 사람이 올려둔 파일 수.
 *
 * security definer인 이유: storage.objects에는 SELECT 정책이 없다(공개 버킷이라
 * 읽기는 공개 URL로 이뤄진다). 정책을 새로 여는 대신, 소유자 권한으로 세기만 하는
 * 함수를 하나 둔다. 소유자(postgres)는 bypassrls라 정책과 무관하게 셀 수 있다.
 */
create or replace function public.submission_photo_count(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::integer
    from storage.objects
   where bucket_id = 'place-images'
     and name like 'submissions/' || p_uid::text || '/%';
$$;

comment on function public.submission_photo_count(uuid) is
  '검수 전 사진 개수. storage 정책이 업로드 상한을 걸 때 쓴다.';

revoke all    on function public.submission_photo_count(uuid) from public, anon;
grant  execute on function public.submission_photo_count(uuid) to authenticated;

-- 상한은 20장이다. 한 건에 5장이므로 대기 중 제보 네 건 분량이고, 승인되면 사진이
-- `<slug>/`로 옮겨가 자리가 다시 빈다. 넉넉하되 무한은 아닌 선이다.
drop policy "place_images_insert_own_submission" on storage.objects;

create policy "place_images_insert_own_submission"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.submission_photo_count((select auth.uid())) < 20
  );
