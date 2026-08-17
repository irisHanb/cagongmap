\set ON_ERROR_STOP on
\echo '=== A. updated_at 트리거 (별도 트랜잭션) ==='
select created_at = updated_at as equal_before from public.places where slug = 'naruteo';

select updated_at > created_at as updated_at_moved from public.places where slug = 'naruteo';

\echo '=== B. anon은 카페를 추가할 수 없다 ==='
begin;
set local role anon;
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time)
  values ('익명이추가', '서울 송파구 어딘가 9', 37.51, 127.10, false, '09:00', '18:00');
  raise exception 'FAIL: anon이 카페를 추가했다';
exception when insufficient_privilege then raise notice 'OK: RLS가 anon insert를 막았다';
end $$;
\echo '-- anon은 제보 목록도 볼 수 없다'
select count(*) as submissions_visible_to_anon from public.place_submissions;
rollback;

\echo '=== C. 다른 사람의 제보는 보이지 않는다 ==='
begin;
set local role authenticated;
set local test.uid = '33333333-3333-3333-3333-333333333333';
select count(*) as visible_to_other_user from public.place_submissions;
rollback;
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as visible_to_reporter from public.place_submissions;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as visible_to_curator from public.place_submissions;
\echo '-- 큐레이터는 draft 카페도 본다'
select count(*) filter (where status = 'draft') as drafts_visible_to_curator from public.places;
rollback;

\echo '=== D. 본인은 자기 role을 올릴 수 없다 ==='
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';
  raise exception 'FAIL: 본인이 role을 올렸다';
exception when insufficient_privilege then
  raise notice 'OK: profiles_update_own의 with check가 막았다';
end $$;
rollback;
select nickname, role from public.profiles order by nickname;

\echo '=== E. isOpenNow가 쓰는 형식 그대로 나오는가 ==='
select slug, open_time, close_time, is_24h
  from public.places
 where slug in ('naruteo', 'twosome-seokchongobun');

\echo '=== F. 북마크는 본인 것만 보이고 본인만 지운다 ==='
-- 제보자(2222)가 나루터를, 큐레이터(1111)가 투썸을 저장한다
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.bookmarks (place_id)
select id from public.places where slug = 'naruteo';
commit;

begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
insert into public.bookmarks (place_id)
select id from public.places where slug = 'twosome-seokchongobun';
commit;

\echo '-- 각자 자기 것 하나씩만 본다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as visible_to_reporter from public.bookmarks;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as visible_to_curator from public.bookmarks;
\echo '-- 큐레이터라고 남의 북마크가 보이지는 않는다'
rollback;

\echo '-- anon은 아무것도 보지 못한다'
begin;
set local role anon;
select count(*) as visible_to_anon from public.bookmarks;
rollback;

\echo '-- 남의 uid로 저장할 수 없다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.bookmarks (user_id, place_id)
  select '11111111-1111-1111-1111-111111111111', id
    from public.places where slug = 'naruteo';
  raise exception 'FAIL: 남의 uid로 북마크를 만들었다';
exception when insufficient_privilege then
  raise notice 'OK: bookmarks_insert_own의 with check가 막았다';
end $$;
rollback;

\echo '-- 남의 북마크는 지워지지 않는다 (0 rows)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with gone as (
  delete from public.bookmarks
   where user_id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select count(*) as others_deleted from gone;
rollback;

\echo '-- update는 정책이 없어 한 행도 걸리지 않는다 (0 rows)'
-- 정책 없는 UPDATE는 예외가 아니라 "해당 행 없음"으로 거부된다.
-- 본인 북마크가 select에는 보이는 상태에서 0이 나와야 의미가 있다.
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as own_visible from public.bookmarks;
with changed as (
  update public.bookmarks set created_at = now() returning 1
)
select count(*) as own_updated from changed;
rollback;

\echo '-- 본인 것은 지워진다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with gone as (
  delete from public.bookmarks returning 1
)
select count(*) as own_deleted from gone;
rollback;

\echo '-- 같은 카페를 두 번 저장할 수 없다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.bookmarks (place_id)
  select id from public.places where slug = 'naruteo';
  raise exception 'FAIL: 같은 카페가 두 번 저장됐다';
exception when unique_violation then
  raise notice 'OK: PK가 중복 저장을 막았다';
end $$;
rollback;
