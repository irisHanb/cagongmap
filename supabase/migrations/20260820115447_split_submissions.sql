-- ============================================================================
--  카공맵 — 제보를 두 테이블로 가른다
-- ----------------------------------------------------------------------------
--  place_submissions 하나가 kind로 셋(new/edit/closed)을 겸하고 있었다. 셋이
--  담는 정보가 서로 다르다 보니 공통 컬럼이 payload jsonb 하나뿐이었고, 그래서
--  "네이버 URL"도 "사진 경로"도 스키마에서 이름을 갖지 못했다. 무엇이 들어올 수
--  있는지가 앱 코드에만 있었다는 뜻이다.
--
--  이제 둘로 가른다.
--
--   * public.place_reports        — 새 장소 제보 (네이버 URL이 필수)
--   * public.place_edit_requests  — 기존 장소 정보 수정 요청 (대상 카페가 필수)
--
--  "필수"가 서로 다르다는 것이 두 테이블로 가른 이유다. 하나로 두면 그 둘 다
--  nullable이 되고, 그러면 어느 쪽도 DB가 보장하지 못한다.
--
--  payload jsonb는 사라진다. 그와 함께 예전의 함정도 사라진다 — approve_submission()이
--  payload를 places 행에 붓느라 사진 키를 photos로 쓰면 안 됐던 문제다.
--  이제 사진은 photo_paths 컬럼이고 places로 새어 들어갈 경로가 없다.
--
--  대신 잃는 것: 폐업 신고(kind='closed') 자리가 없어진다. 화면이 없어 쓰인 적이
--  없고(docs/scope.md), 필요해지면 place_closure_reports를 따로 만든다.
-- ============================================================================

-- 상태 enum(pending/approved/rejected)은 그대로 쓴다. 셋의 의미가 두 테이블에서
-- 같으므로 새로 만들 이유가 없다.


-- ─── 새 장소 제보 ───────────────────────────────────────────────────────────

create table public.place_reports (
  id              uuid  primary key default gen_random_uuid(),

  submitted_by    uuid  not null default auth.uid()
                        references auth.users(id) on delete cascade,

  -- 이 테이블의 존재 이유. 어떤 가게인지 가리키는 유일한 값이라 not null이다.
  naver_place_url text  not null check (naver_place_url ~ '^https://\S+$'),

  -- ⚠️ URL이 아니라 submission-images 버킷의 오브젝트 경로다(`<uid>/<uuid>.jpg`).
  --    버킷이 비공개라 URL로 만들어 넣어도 화면에서 열리지 않는다.
  photo_paths     text[]  not null default '{}'
                  check (
                    cardinality(photo_paths) = 0
                    or array_to_string(photo_paths, ' ') !~ '://'
                  ),

  note            text,

  status          public.submission_status  not null default 'pending',

  -- 승인되면 그때 만들어진 카페를 가리킨다. 제보 → 실제 등록을 추적하는 고리다.
  place_id        uuid  references public.places(id) on delete set null,

  reviewed_by     uuid  references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text,

  created_at      timestamptz  not null default now(),

  -- 대기 중에는 아직 만들어진 카페가 없다.
  constraint place_reports_pending_has_no_place check (
    status <> 'pending' or place_id is null
  ),
  -- 승인은 곧 "이 카페로 등록했다"이다. 가리키는 곳 없이 승인될 수 없다.
  constraint place_reports_approved_has_place check (
    status <> 'approved' or place_id is not null
  )
);

comment on table public.place_reports is
  '사용자가 보낸 새 장소 제보. 승인하면 place_id가 등록된 카페를 가리킨다.';
comment on column public.place_reports.photo_paths is
  'submission-images 버킷의 오브젝트 경로. URL이 아니다.';

-- 같은 사람이 같은 가게를 대기 중에 두 번 제보하지 못하게.
-- URL이 실질적인 가게 식별자라 places_naver_place_url_key와 짝이 맞는다.
create unique index place_reports_one_pending_per_url
  on public.place_reports (submitted_by, naver_place_url)
  where status = 'pending';

create index place_reports_pending_idx
  on public.place_reports (created_at)
  where status = 'pending';


-- ─── 정보 수정 요청 ─────────────────────────────────────────────────────────

create table public.place_edit_requests (
  id            uuid  primary key default gen_random_uuid(),

  -- 이 테이블의 존재 이유. 어느 카페 이야기인지 없으면 아무것도 아니다.
  place_id      uuid  not null references public.places(id) on delete cascade,

  submitted_by  uuid  not null default auth.uid()
                      references auth.users(id) on delete cascade,

  -- place_reports와 같은 규칙 — 버킷 경로이지 URL이 아니다.
  photo_paths   text[]  not null default '{}'
                check (
                  cardinality(photo_paths) = 0
                  or array_to_string(photo_paths, ' ') !~ '://'
                ),

  note          text,

  status        public.submission_status  not null default 'pending',

  reviewed_by   uuid  references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,

  created_at    timestamptz  not null default now(),

  -- 사진도 메모도 없으면 보낼 내용이 없다. 폼이 막고 있는 규칙이지만
  -- 빈 요청이 쌓이면 검수하는 사람이 그것을 하나하나 열어봐야 한다.
  constraint place_edit_requests_has_content check (
    cardinality(photo_paths) > 0
    or (note is not null and btrim(note) <> '')
  )
);

comment on table public.place_edit_requests is
  '기존 장소 정보가 다르다는 제보. 사진과 메모만 받고, 무엇을 고칠지는 사람이 읽고 판단한다.';

create unique index place_edit_requests_one_pending_per_place
  on public.place_edit_requests (submitted_by, place_id)
  where status = 'pending';

create index place_edit_requests_pending_idx
  on public.place_edit_requests (created_at)
  where status = 'pending';

-- places 삭제 시 cascade가 쓴다.
create index place_edit_requests_place_id_idx
  on public.place_edit_requests (place_id);


-- ─── RLS ────────────────────────────────────────────────────────────────────
--  둘 다 같은 규칙이다. 예전 place_submissions의 정책을 그대로 옮겼다.

alter table public.place_reports       enable row level security;
alter table public.place_edit_requests enable row level security;

-- INSERT — 남의 이름으로 보낼 수 없고, 보낸 것은 항상 pending에서 시작한다.
create policy "place_reports_insert_own"
  on public.place_reports
  for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
  );

create policy "place_edit_requests_insert_own"
  on public.place_edit_requests
  for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
  );

-- SELECT — 본인 것과 큐레이터. 남이 무엇을 제보했는지는 보이지 않는다.
create policy "place_reports_select_own_or_curator"
  on public.place_reports
  for select
  to authenticated
  using (
    submitted_by = (select auth.uid())
    or public.is_curator((select auth.uid()))
  );

create policy "place_edit_requests_select_own_or_curator"
  on public.place_edit_requests
  for select
  to authenticated
  using (
    submitted_by = (select auth.uid())
    or public.is_curator((select auth.uid()))
  );

-- UPDATE — 검수 전까지는 본인이 고칠 수 있다. with check가 없으면 본인 요청을
-- 스스로 승인 처리하거나 남에게 넘길 수 있다.
create policy "place_reports_update_own_pending"
  on public.place_reports
  for update
  to authenticated
  using      (submitted_by = (select auth.uid()) and status = 'pending')
  with check (submitted_by = (select auth.uid()) and status = 'pending');

create policy "place_edit_requests_update_own_pending"
  on public.place_edit_requests
  for update
  to authenticated
  using      (submitted_by = (select auth.uid()) and status = 'pending')
  with check (submitted_by = (select auth.uid()) and status = 'pending');

-- DELETE 정책은 만들지 않는다. 보낸 사람이 지우면 검수 이력이 사라지고,
-- 큐레이터에게는 반려(rejected)가 있다. 정책 없는 명령은 거부되므로 delete는
-- 전부 막힌 상태가 된다. 빠뜨린 것이 아니라 설계다.

create policy "place_reports_curator_all"
  on public.place_reports
  for all
  to authenticated
  using      (public.is_curator((select auth.uid())))
  with check (public.is_curator((select auth.uid())));

create policy "place_edit_requests_curator_all"
  on public.place_edit_requests
  for all
  to authenticated
  using      (public.is_curator((select auth.uid())))
  with check (public.is_curator((select auth.uid())));


-- ─── 승인 · 반려 ────────────────────────────────────────────────────────────
--  예전 approve_submission()은 payload를 places 행에 부어 카페를 만들었다.
--  이제 두 테이블 어느 쪽도 places를 채울 만큼의 정보를 담지 않으므로
--  (제보는 URL·사진·메모뿐, 수정 요청은 사진·메모뿐), 카페를 만들고 고치는 일은
--  큐레이터가 하고 함수는 **연결과 상태 전환만** 맡는다.
--
--  이것이 이 변경으로 가장 정직해진 부분이다. 예전 함수는 사용자가 보내지 않은
--  값을 사용자가 보낸 것처럼 places에 반영했다.

create or replace function public.approve_place_report(
  p_report_id uuid,
  p_place_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.submission_status;
begin
  if not public.is_curator(auth.uid()) then
    raise exception '큐레이터만 제보를 승인할 수 있습니다';
  end if;

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
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_report_id;
end;
$$;

comment on function public.approve_place_report(uuid, uuid) is
  '제보를 승인하고 큐레이터가 만든 카페에 연결한다. 카페 생성 자체는 하지 않는다.';

/**
 * 수정 요청 승인.
 *
 * 요청에는 자유 메모와 사진뿐이라 자동으로 반영할 구조화된 값이 없다. 실제 수정은
 * 큐레이터가 places를 직접 고치는 것이고, 이 함수는 그 사실을 기록한다 —
 * 확인일(last_verified)을 오늘로 옮기는 것이 "사람이 다시 봤다"의 의미다.
 */
create or replace function public.approve_edit_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.place_edit_requests;
begin
  if not public.is_curator(auth.uid()) then
    raise exception '큐레이터만 수정 요청을 승인할 수 있습니다';
  end if;

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

  update public.places
     set last_verified = current_date,
         verified_by   = auth.uid()
   where id = r.place_id;

  update public.place_edit_requests
     set status      = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id;
end;
$$;

create or replace function public.reject_place_report(
  p_report_id uuid,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_curator(auth.uid()) then
    raise exception '큐레이터만 제보를 반려할 수 있습니다';
  end if;

  update public.place_reports
     set status      = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_reason
   where id = p_report_id
     and status = 'pending';
end;
$$;

create or replace function public.reject_edit_request(
  p_request_id uuid,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_curator(auth.uid()) then
    raise exception '큐레이터만 수정 요청을 반려할 수 있습니다';
  end if;

  update public.place_edit_requests
     set status      = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_reason
   where id = p_request_id
     and status = 'pending';
end;
$$;

revoke all    on function public.approve_place_report(uuid, uuid) from public, anon;
revoke all    on function public.approve_edit_request(uuid)       from public, anon;
revoke all    on function public.reject_place_report(uuid, text)  from public, anon;
revoke all    on function public.reject_edit_request(uuid, text)  from public, anon;
grant  execute on function public.approve_place_report(uuid, uuid) to authenticated;
grant  execute on function public.approve_edit_request(uuid)       to authenticated;
grant  execute on function public.reject_place_report(uuid, text)  to authenticated;
grant  execute on function public.reject_edit_request(uuid, text)  to authenticated;


-- ─── 기존 제보 옮기기 ───────────────────────────────────────────────────────
--  옮길 수 없는 행이 있으면 멈춘다. 조용히 버리고 테이블을 드롭하면 사용자가
--  보낸 것이 사라진 줄도 모르게 된다.

do $$
declare v_stuck int;
begin
  -- 새 테이블의 제약에 걸릴 행을 **미리** 전부 센다. 하나라도 남기면 아래 insert가
  -- raw 제약 오류로 죽어서, 무엇을 손봐야 하는지 알 수 없는 메시지만 남는다.
  select count(*) into v_stuck
    from public.place_submissions s
   where s.kind = 'closed'
      -- 신규: 네이버 URL이 없거나 https 형식이 아니면 place_reports가 거부한다
      or (s.kind = 'new'
          and coalesce(s.payload ->> 'naver_place_url', '') !~ '^https://\S+$')
      -- 수정: 대상이 없으면 not null에, 사진도 메모도 없으면 has_content에 걸린다
      or (s.kind = 'edit'
          and (s.place_id is null
               or (coalesce(jsonb_array_length(s.payload -> 'photo_paths'), 0) = 0
                   and coalesce(btrim(s.note), '') = '')));

  if v_stuck > 0 then
    raise exception
      '옮길 수 없는 제보 %건이 있습니다 (폐업 신고 / 네이버 URL이 없거나 형식이 틀린 신규 제보 / 대상이나 내용이 없는 수정 요청). 손으로 처리한 뒤 다시 실행하세요',
      v_stuck;
  end if;
end $$;

insert into public.place_reports (
  id, submitted_by, naver_place_url, photo_paths, note,
  status, place_id, reviewed_by, reviewed_at, review_note, created_at
)
select
  s.id,
  s.submitted_by,
  s.payload ->> 'naver_place_url',
  coalesce(
    (select array_agg(value #>> '{}') from jsonb_array_elements(s.payload -> 'photo_paths')),
    '{}'
  ),
  s.note,
  s.status,
  s.place_id,
  s.reviewed_by,
  s.reviewed_at,
  s.review_note,
  s.created_at
from public.place_submissions s
where s.kind = 'new';

insert into public.place_edit_requests (
  id, place_id, submitted_by, photo_paths, note,
  status, reviewed_by, reviewed_at, review_note, created_at
)
select
  s.id,
  s.place_id,
  s.submitted_by,
  coalesce(
    (select array_agg(value #>> '{}') from jsonb_array_elements(s.payload -> 'photo_paths')),
    '{}'
  ),
  s.note,
  s.status,
  s.reviewed_by,
  s.reviewed_at,
  s.review_note,
  s.created_at
from public.place_submissions s
where s.kind = 'edit';


-- ─── 옛 구조 걷어내기 ───────────────────────────────────────────────────────
--  쓰지 않는 테이블을 남겨 두면 다음 사람이 어느 쪽이 진짜인지 알 수 없다.

drop function if exists public.approve_submission(uuid);
drop function if exists public.reject_submission(uuid, text);
drop table    if exists public.place_submissions;
drop type     if exists public.submission_kind;
