-- 검증 전용 스텁: Supabase가 기본 제공하는 것들(auth 스키마·역할·grant)을
-- 흉내 낸다.
-- 실제 프로젝트에는 적용하지 않는다.
-- 역할은 클러스터 단위라 DB를 지워도 남는다 (재실행 대비)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- 실제로는 JWT 클레임에서 읽는다. 테스트에서는 GUC로 주입한다.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

-- 승인 함수가 "세션 없이 온 service_role인가"를 이것으로 가른다.
-- 실제로는 JWT의 role 클레임이고, 정의자 함수 안에서도 호출자 것이 그대로 보인다
-- (current_user는 소유자로 바뀌므로 역할 판정에 쓰면 안 된다).
create or replace function auth.role()
returns text language sql stable as $$
  select nullif(current_setting('test.role', true), '');
$$;

create extension if not exists pgcrypto;

-- Supabase 기본 grant 재현
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- ─── storage 스텁 ───────────────────────────────────────────────────────────
--  Supabase Storage가 만드는 스키마를 정책 검증에 필요한 만큼만 흉내 낸다.
--  실제 컬럼은 훨씬 많지만(owner, metadata, version, …) 정책이 보는 것은
--  bucket_id와 name뿐이라 그 둘과 PK만 둔다.
--
--  실제 프로젝트에서는 storage.objects의 RLS가 이미 켜져 있고 소유자가
--  supabase_storage_admin이다. 여기서는 postgres가 만들고 직접 켠다 — 그래서
--  마이그레이션은 `alter table ... enable row level security`를 부르면 안 된다.
--  (실제 프로젝트에서 그 문장은 권한 오류로 깨진다)

create schema if not exists storage;

create table storage.buckets (
  id                 text  primary key,
  name               text  not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table storage.objects (
  id         uuid  primary key default gen_random_uuid(),
  bucket_id  text  references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);

-- 'uid/파일.jpg' → {uid, 파일.jpg}. 실제 구현과 같은 시그니처다.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects  to anon, authenticated, service_role;
grant select, insert, update, delete on storage.buckets  to anon, authenticated, service_role;
