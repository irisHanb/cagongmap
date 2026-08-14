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

create extension if not exists pgcrypto;

-- Supabase 기본 grant 재현
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
