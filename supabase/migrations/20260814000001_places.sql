-- ============================================================================
--  카공맵 — 장소 원본 테이블
-- ----------------------------------------------------------------------------
--  테이블 이름은 places다. 지금 담기는 것은 카페뿐이지만, 나중에 스터디카페나
--  도서관까지 넓힐 때 테이블을 다시 만들지 않아도 되게 한 것이다.
--
--  출발점은 data/cafes.json(9곳)이다. 필드 이름을 그대로 유지해서
--  lib/cafes.ts가 JSON → Supabase로 갈아탈 때 매핑 코드가 필요 없게 했다.
--  (types/cafe.ts의 Cafe 인터페이스가 그대로 row 모양이 된다)
-- ============================================================================

create extension if not exists pgcrypto;


-- ─── enum ───────────────────────────────────────────────────────────────────
-- types/cafe.ts의 유니온과 1:1. 시드에 아직 없는 값(few/none/noisy/bad)도 열어둔다.

create type public.outlet_level as enum ('many', 'some', 'few', 'none');
create type public.noise_level  as enum ('quiet', 'normal', 'noisy');
create type public.work_fit     as enum ('good', 'ok', 'bad');

-- 열려 있는 결정(scope.md 미확정 이슈 ②): 카공 허용 정책.
-- 타입만 미리 만들어 두고 컬럼은 nullable로 둔다 — 도입을 강제하지도, 막지도 않는다.
create type public.work_policy  as enum ('welcome', 'allowed', 'frowned', 'banned');

-- 제보로 들어온 카페는 검수 전까지 draft에 머문다. closed = 폐업.
create type public.place_status  as enum ('draft', 'published', 'hidden', 'closed');


-- ─── 테이블 ─────────────────────────────────────────────────────────────────

create table public.places (
  id                    uuid          primary key default gen_random_uuid(),

  -- 시드 9곳의 기존 id('naruteo' 등)를 그대로 보존한다. URL에 쓰기 좋은 키.
  -- 제보로 생성된 카페는 큐레이터가 붙여주기 전까지 null.
  slug                  text          unique,

  name                  text          not null,
  address               text          not null,
  -- 권역 확장(송파·잠실 → 그 외) 대비. address에서 뽑은 자치구.
  district              text,

  lat                   double precision  not null check (lat between  33 and  39),
  lng                   double precision  not null check (lng between 124 and 132),

  -- 사진은 직접 호스팅하지 않고 여기로 넘긴다 (mvp-decisions.md 3절).
  naver_place_url       text,

  -- time이 아니라 text + 정규식이다. PostgREST가 time을 "12:00:00"으로 돌려주면
  -- formatBusinessHours()가 "12:00:00 - 21:30:00"을 그리게 되므로 "HH:mm"을 유지한다.
  open_time             text
    check (open_time  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  close_time            text
    check (close_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  is_24h                boolean       not null default false,

  iced_americano_price  integer       check (iced_americano_price >= 0),

  -- 운영자가 직접 채워야 하는 핵심 자산 (scope.md)
  outlet                public.outlet_level,
  wifi                  boolean,
  noise                 public.noise_level,
  work_fit              public.work_fit,
  -- 보류 중. 도입 결정 전까지 계속 null이어도 정상이다.
  work_policy           public.work_policy,

  tags                  text[]        not null default '{}',
  status                public.place_status  not null default 'draft',

  -- 신선도를 숨기지 않는다 (mvp-decisions.md 2-3). UI에 "확인일"로 노출된다.
  last_verified         date,
  verified_by           uuid          references auth.users(id) on delete set null,

  created_by            uuid          references auth.users(id) on delete set null,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),

  -- 24시간 영업이 아니면 영업시간이 있어야 한다 (isOpenNow가 이 전제 위에 있다)
  constraint places_hours_required check (
    is_24h
    or (open_time is not null and close_time is not null)
  ),

  -- 공개하려면 핵심 속성과 확인일이 채워져 있어야 한다.
  -- "속성이 비어 있는 카페를 지도에 올리지 않는다"를 DB에 박아둔 것.
  constraint places_published_requires_core check (
    status <> 'published'
    or (
      outlet        is not null
      and wifi      is not null
      and noise     is not null
      and work_fit  is not null
      and last_verified is not null
    )
  )
);

comment on column public.places.slug is
  'data/cafes.json 시절의 id. URL 키로 쓴다.';
comment on column public.places.work_policy is
  '카공 허용 정책. scope.md 미확정 이슈 ② — 도입 여부 미결정.';


-- ─── 인덱스 ─────────────────────────────────────────────────────────────────

create index places_status_idx
  on public.places (status);

-- 지도 뷰포트(bbox) 조회용. 규모가 커지면 PostGIS geography + GiST로 교체.
create index places_lat_lng_idx
  on public.places (lat, lng);

create index places_tags_idx
  on public.places using gin (tags);

-- 같은 장소가 제보로 두 번 등록되는 것을 막는 실질적 유일 키
create unique index places_naver_place_url_key
  on public.places (naver_place_url)
  where naver_place_url is not null;


-- ─── updated_at ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger places_set_updated_at
  before update on public.places
  for each row
  execute function public.set_updated_at();


-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.places enable row level security;

-- 조회는 공개. 단 published만 — draft/hidden/closed는 익명에게 보이지 않는다.
create policy "places_select_published"
  on public.places
  for select
  to anon, authenticated
  using (status = 'published');

-- 쓰기 정책은 profiles(role)이 필요하므로 다음 마이그레이션에서 추가한다.
-- 그때까지 쓰기는 service_role(서버 전용 키)로만 가능하다.
