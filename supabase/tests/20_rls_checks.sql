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
select count(*) as reports_visible_to_anon       from public.place_reports;
select count(*) as edit_requests_visible_to_anon from public.place_edit_requests;
rollback;

\echo '=== C. 다른 사람의 제보·수정 요청은 보이지 않는다 ==='
begin;
set local role authenticated;
set local test.uid = '33333333-3333-3333-3333-333333333333';
select count(*) as reports_visible_to_other_user      from public.place_reports;
select count(*) as edit_requests_visible_to_other_user from public.place_edit_requests;
rollback;
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as reports_visible_to_reporter      from public.place_reports;
select count(*) as edit_requests_visible_to_reporter from public.place_edit_requests;
\echo '-- 남의 이름으로 제보할 수 없다'
do $$
begin
  insert into public.place_reports (submitted_by, naver_place_url)
  values ('11111111-1111-1111-1111-111111111111', 'https://naver.me/spoofed');
  raise exception 'FAIL: 남의 이름으로 제보했다';
exception when insufficient_privilege then
  raise notice 'OK: place_reports_insert_own의 with check가 막았다';
end $$;
\echo '-- 보낸 사람이 스스로 승인할 수 없다 (대기 중인 수정 요청으로 확인)'
do $$
begin
  update public.place_edit_requests set status = 'approved';
  raise exception 'FAIL: 보낸 사람이 스스로 승인했다';
exception when insufficient_privilege then
  raise notice 'OK: place_edit_requests_update_own_pending의 with check가 막았다';
end $$;
\echo '-- 보낸 것을 지울 수는 없다 (delete 정책이 없다, 0 rows)'
with gone as (delete from public.place_reports returning 1)
select count(*) as own_deleted from gone;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as reports_visible_to_curator      from public.place_reports;
select count(*) as edit_requests_visible_to_curator from public.place_edit_requests;
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

\echo '=== G. 리뷰는 본인 것만 보이고 집계만 공개된다 ==='
-- 제보자(2222)와 큐레이터(1111)가 나루터에 각각 평가를 남긴다
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_reviews (place_id, value)
select id, 'good' from public.places where slug = 'naruteo';
commit;

begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
insert into public.place_reviews (place_id, value)
select id, 'bad' from public.places where slug = 'naruteo';
commit;

\echo '-- 각자 자기 것 하나씩만 본다 (큐레이터도 예외가 아니다)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as visible_to_reporter from public.place_reviews;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as visible_to_curator from public.place_reviews;
rollback;

\echo '-- anon은 원본을 한 행도 못 본다'
begin;
set local role anon;
select count(*) as visible_to_anon from public.place_reviews;
\echo '-- 그래도 집계는 볼 수 있다 (good=1, bad=1)'
select * from public.place_review_counts(
  (select id from public.places where slug = 'naruteo'));
rollback;

\echo '-- 남의 uid로 평가할 수 없다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reviews (user_id, place_id, value)
  select '11111111-1111-1111-1111-111111111111', id, 'good'
    from public.places where slug = 'twosome-seokchongobun';
  raise exception 'FAIL: 남의 uid로 평가를 만들었다';
exception when insufficient_privilege then
  raise notice 'OK: place_reviews_insert_own의 with check가 막았다';
end $$;
rollback;

\echo '-- 평가를 바꿔도 행은 하나다 (good → normal)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
update public.place_reviews set value = 'normal';
select count(*) as own_rows, max(value::text) as own_value from public.place_reviews;
rollback;

\echo '-- 본인 행의 주인을 남에게 넘길 수 없다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  update public.place_reviews
     set user_id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: 평가의 주인이 넘어갔다';
exception when insufficient_privilege then
  raise notice 'OK: place_reviews_update_own의 with check가 막았다';
end $$;
rollback;

\echo '-- 같은 장소에 두 번 평가할 수 없다 (PK)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reviews (place_id, value)
  select id, 'bad' from public.places where slug = 'naruteo';
  raise exception 'FAIL: 같은 장소에 평가가 두 번 들어갔다';
exception when unique_violation then
  raise notice 'OK: PK가 중복 평가를 막았다';
end $$;
rollback;

\echo '=== H. 제보 사진은 본인 폴더에만 올라간다 ==='
-- 카페 사진과 같은 버킷을 쓴다. 갈리는 것은 경로뿐 — submissions/<uid>/ 아래만
-- 사용자가 쓸 수 있고, 카페 사진이 놓이는 <slug>/ 는 열려 있지 않다.
-- 버킷은 마이그레이션이 만든다(20260820121437). 여기서 다시 만들지 않는다.

\echo '-- 본인 폴더에는 올라간다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with put as (
  insert into storage.objects (bucket_id, name)
  values ('place-images',
          'submissions/22222222-2222-2222-2222-222222222222/a1b2c3.jpg')
  returning 1
)
select count(*) as own_upload from put;
commit;

\echo '-- 남의 폴더에는 못 올린다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('place-images',
          'submissions/11111111-1111-1111-1111-111111111111/훔친사진.jpg');
  raise exception 'FAIL: 남의 폴더에 파일을 올렸다';
exception when insufficient_privilege then
  raise notice 'OK: place_images_insert_own_submission이 막았다';
end $$;
rollback;

\echo '-- 카페 사진 자리(<slug>/)에는 직접 못 올린다'
-- 승인된 사진을 그리로 옮기는 것은 service_role을 쓰는 운영 스크립트뿐이다.
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('place-images', 'naruteo/내가올린사진.jpg');
  raise exception 'FAIL: 카페 사진 자리에 파일이 올라갔다';
exception when insufficient_privilege then
  raise notice 'OK: 경로 조건이 막았다';
end $$;
rollback;

\echo '-- update는 정책이 없어 한 행도 걸리지 않는다 (0 rows)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with changed as (
  update storage.objects set name = name || '.moved' returning 1
)
select count(*) as own_updated from changed;
rollback;

\echo '-- 본인이 올린 것은 지울 수 있다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with gone as (
  delete from storage.objects returning 1
)
select count(*) as own_deleted from gone;
rollback;

\echo '=== I. 버킷 설정 ==='
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'place-images';
