-- ============================================================================
--  카공맵 — 사용자 프로필 + 제보(UGC)
-- ----------------------------------------------------------------------------
--  scope.md: UGC는 최종 목표에 포함되지만 1차 범위 밖이다.
--  이 마이그레이션은 "나중에 붙일 자리"를 미리 파둔 것이며,
--  여기 테이블이 비어 있어도 1차 구현(조회 전용)은 그대로 돈다.
-- ============================================================================


-- ─── 프로필 ─────────────────────────────────────────────────────────────────

create type public.user_role as enum ('user', 'curator', 'admin');

create table public.profiles (
  id          uuid              primary key references auth.users(id) on delete cascade,
  nickname    text,
  role        public.user_role  not null default 'user',
  created_at  timestamptz       not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    -- role 승격은 본인이 못 한다 (service_role 또는 관리자만)
    and role = (
      select p.role from public.profiles p where p.id = (select auth.uid())
    )
  );

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 정책 안에서 profiles를 직접 select하면 RLS 재귀에 걸리므로
-- security definer 함수로 감싼다.
create or replace function public.is_curator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = uid
       and role in ('curator', 'admin')
  );
$$;

-- 큐레이터는 모든 카페를 보고 고칠 수 있다
create policy "places_curator_all"
  on public.places
  for all
  to authenticated
  using      (public.is_curator((select auth.uid())))
  with check (public.is_curator((select auth.uid())));


-- ─── 제보 ───────────────────────────────────────────────────────────────────

create type public.submission_kind   as enum ('new', 'edit', 'closed');
create type public.submission_status as enum ('pending', 'approved', 'rejected');

-- payload는 jsonb다. places의 15개 컬럼을 nullable로 한 번 더 복제하면
-- 두 스키마가 반드시 어긋나므로, 제안 값은 통째로 담고 검수 시점에 반영한다.
create table public.place_submissions (
  id            uuid                      primary key default gen_random_uuid(),
  kind          public.submission_kind    not null,
  -- new = 신규 등록(대상 없음) / edit·closed = 기존 카페 대상
  place_id       uuid                      references public.places(id) on delete cascade,
  submitted_by  uuid                      not null default auth.uid()
                                          references auth.users(id) on delete cascade,

  payload       jsonb                     not null default '{}'::jsonb,
  note          text,

  status        public.submission_status  not null default 'pending',
  reviewed_by   uuid                      references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,

  created_at    timestamptz               not null default now(),

  -- edit·closed는 대상 카페가 반드시 있어야 한다
  constraint submissions_target_required check (
    kind = 'new' or place_id is not null
  ),

  -- new는 대기 중일 때 대상이 없다. 승인되면 그때 생성된 카페를 가리키게 된다
  -- (제보 → 실제로 등록된 카페를 추적할 수 있어야 하므로 승인 후에는 채운다).
  constraint submissions_new_has_no_target_while_pending check (
    kind <> 'new' or status <> 'pending' or place_id is null
  ),

  -- 제보자가 신분·상태 컬럼을 건드리지 못하게 한다
  constraint submissions_payload_keys check (
    not (payload ?| array[
      'id', 'slug', 'status',
      'created_by', 'verified_by',
      'created_at', 'updated_at'
    ])
  )
);

-- 같은 사람이 같은 카페에 대기 중 제보를 여러 건 쌓지 못하게
create unique index place_submissions_one_pending_per_place
  on public.place_submissions (submitted_by, place_id)
  where status = 'pending' and place_id is not null;

create index place_submissions_pending_idx
  on public.place_submissions (created_at)
  where status = 'pending';

alter table public.place_submissions enable row level security;

create policy "submissions_insert_own"
  on public.place_submissions
  for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
  );

create policy "submissions_select_own_or_curator"
  on public.place_submissions
  for select
  to authenticated
  using (
    submitted_by = (select auth.uid())
    or public.is_curator((select auth.uid()))
  );

-- 검수 전까지는 본인이 고칠 수 있다
create policy "submissions_update_own_pending"
  on public.place_submissions
  for update
  to authenticated
  using      (submitted_by = (select auth.uid()) and status = 'pending')
  with check (submitted_by = (select auth.uid()) and status = 'pending');

create policy "submissions_curator_all"
  on public.place_submissions
  for all
  to authenticated
  using      (public.is_curator((select auth.uid())))
  with check (public.is_curator((select auth.uid())));


-- ─── 승인 · 반려 ────────────────────────────────────────────────────────────
--  제보 반영과 상태 변경이 한 트랜잭션 안에서 끝나야 하므로 함수로 둔다.
--  승인은 곧 "운영자가 확인했다"이므로 last_verified를 오늘로 갱신한다.

create or replace function public.approve_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.place_submissions;
  p          public.places;
  v_place_id  uuid;
begin
  ---- 권한 · 상태 확인 ------------------------------------------------------
  if not public.is_curator(auth.uid()) then
    raise exception '큐레이터만 제보를 승인할 수 있습니다';
  end if;

  select *
    into s
    from public.place_submissions
   where id = p_submission_id
     for update;

  if not found then
    raise exception '제보를 찾을 수 없습니다: %', p_submission_id;
  end if;

  if s.status <> 'pending' then
    raise exception '이미 처리된 제보입니다 (status=%)', s.status;
  end if;

  ---- 폐업 신고 -------------------------------------------------------------
  if s.kind = 'closed' then
    update public.places
       set status        = 'closed',
           last_verified = current_date,
           verified_by   = auth.uid()
     where id = s.place_id;

    v_place_id := s.place_id;

  ---- 신규 등록 · 수정 ------------------------------------------------------
  else
    -- edit이면 기존 행 위에, new면 빈 행 위에 payload를 덮어쓴다.
    -- jsonb_populate_record는 payload에 있는 키만 반영하므로 부분 수정이 그대로 된다.
    if s.kind = 'edit' then
      select * into p from public.places where id = s.place_id for update;
    else
      p := null::public.places;
    end if;

    p := jsonb_populate_record(p, s.payload);

    if s.kind = 'edit' then
      update public.places
         set name                 = p.name,
             address              = p.address,
             district             = p.district,
             lat                  = p.lat,
             lng                  = p.lng,
             naver_place_url      = p.naver_place_url,
             open_time            = p.open_time,
             close_time           = p.close_time,
             is_24h               = coalesce(p.is_24h, false),
             iced_americano_price = p.iced_americano_price,
             outlet               = p.outlet,
             wifi                 = p.wifi,
             noise                = p.noise,
             work_fit             = p.work_fit,
             work_policy          = p.work_policy,
             tags                 = coalesce(p.tags, '{}'),
             last_verified        = current_date,
             verified_by          = auth.uid()
       where id = s.place_id;

      v_place_id := s.place_id;

    else
      insert into public.places (
        name, address, district, lat, lng, naver_place_url,
        open_time, close_time, is_24h, iced_americano_price,
        outlet, wifi, noise, work_fit, work_policy, tags,
        status, last_verified, verified_by, created_by
      )
      values (
        p.name, p.address, p.district, p.lat, p.lng, p.naver_place_url,
        p.open_time, p.close_time, coalesce(p.is_24h, false), p.iced_americano_price,
        p.outlet, p.wifi, p.noise, p.work_fit, p.work_policy, coalesce(p.tags, '{}'),

        -- 핵심 속성이 비어 있으면 published가 places_published_requires_core에 걸린다.
        -- 그런 제보는 draft로 들여놓고 운영자가 채운다.
        case
          when p.outlet is not null
           and p.wifi   is not null
           and p.noise  is not null
           and p.work_fit is not null
          then 'published'::public.place_status
          else 'draft'::public.place_status
        end,

        current_date, auth.uid(), s.submitted_by
      )
      returning id into v_place_id;
    end if;
  end if;

  ---- 제보 상태 갱신 --------------------------------------------------------
  update public.place_submissions
     set status      = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         -- new 제보는 여기서 비로소 생성된 카페를 가리키게 된다
         place_id     = coalesce(place_id, v_place_id)
   where id = p_submission_id;

  return v_place_id;
end;
$$;

create or replace function public.reject_submission(
  p_submission_id uuid,
  p_reason        text default null
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

  update public.place_submissions
     set status      = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_reason
   where id = p_submission_id
     and status = 'pending';
end;
$$;

revoke all    on function public.approve_submission(uuid)      from public, anon;
revoke all    on function public.reject_submission(uuid, text) from public, anon;
grant  execute on function public.approve_submission(uuid)      to authenticated;
grant  execute on function public.reject_submission(uuid, text) to authenticated;
