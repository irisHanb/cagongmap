\set ON_ERROR_STOP on

-- ─── 단언 ───────────────────────────────────────────────────────────────────
--  ⚠️ **`select count(*)`를 그냥 두지 않는다.** psql은 값이 무엇이 나오든 exit 0이라,
--     출력만 하는 검사는 RLS를 통째로 지워도 통과한다. 2026-08-23 보안 감사에서
--     이 파일의 절반이 그 상태였다 (docs/security-audit-2026-08-23/README.md).
--
--  pg_temp에 두는 이유: 검증 컨테이너의 이 세션에만 있으면 되고, 마이그레이션이
--  아니므로 실제 프로젝트에 남을 자리가 없어야 한다.
create or replace function pg_temp.assert_eq(actual bigint, expected bigint, what text)
returns text language plpgsql as $assert$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — 기대 %, 실제 %', what, expected, actual;
  end if;
  return 'OK: ' || what || ' (' || actual || ')';
end;
$assert$;

create or replace function pg_temp.assert_eq(actual text, expected text, what text)
returns text language plpgsql as $assert$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — 기대 %, 실제 %', what, expected, actual;
  end if;
  return 'OK: ' || what || ' (' || actual || ')';
end;
$assert$;
\echo '=== A. updated_at 트리거 (별도 트랜잭션) ==='
select pg_temp.assert_eq((updated_at > created_at)::text, 'true',
                         'set_updated_at 트리거가 updated_at을 옮겼다')
  from public.places where slug = 'naruteo';

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
select pg_temp.assert_eq(count(*), 0, 'anon에게 제보가 보이지 않는다')       from public.place_reports;
select pg_temp.assert_eq(count(*), 0, 'anon에게 수정 요청이 보이지 않는다') from public.place_edit_requests;
rollback;

\echo '=== C. 다른 사람의 제보·수정 요청은 보이지 않는다 ==='
begin;
set local role authenticated;
set local test.uid = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert_eq(count(*), 0, '남의 제보는 보이지 않는다')      from public.place_reports;
select pg_temp.assert_eq(count(*), 0, '남의 수정 요청은 보이지 않는다') from public.place_edit_requests;
rollback;
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_eq(count(*), 3, '보낸 사람에게 자기 제보가 보인다')      from public.place_reports;
select pg_temp.assert_eq(count(*), 2, '보낸 사람에게 자기 수정 요청이 보인다') from public.place_edit_requests;
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
select pg_temp.assert_eq(count(*), 0, '보낸 제보를 스스로 지울 수 없다') from gone;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_eq(count(*), 3, '큐레이터에게 제보가 전부 보인다')      from public.place_reports;
select pg_temp.assert_eq(count(*), 2, '큐레이터에게 수정 요청이 전부 보인다') from public.place_edit_requests;
\echo '-- 큐레이터는 draft 카페도 본다'
select pg_temp.assert_eq(count(*) filter (where status = 'draft'), 2, '큐레이터는 draft 카페도 본다') from public.places;
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
select pg_temp.assert_eq(role::text, 'user', '제보자의 role은 그대로 user다')
  from public.profiles where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_eq(role::text, 'curator', '큐레이터의 role은 그대로 curator다')
  from public.profiles where id = '11111111-1111-1111-1111-111111111111';

\echo '=== E. isOpenNow가 쓰는 형식 그대로 나오는가 ==='
-- 나루터의 12:00~00:00이 lib/openState.ts의 자정 넘김 경로를 타는 값이다.
-- 이 값이 사라지면 그 분기가 죽은 코드가 되므로 여기서 붙잡아 둔다.
select pg_temp.assert_eq(open_time || '~' || close_time, '12:00~00:00',
                         '나루터는 자정을 넘기는 영업시간을 그대로 들고 있다')
  from public.places where slug = 'naruteo';

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
select pg_temp.assert_eq(count(*), 1, '북마크는 본인 것만 보인다 (제보자)') from public.bookmarks;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_eq(count(*), 1, '북마크는 본인 것만 보인다 (큐레이터)') from public.bookmarks;
\echo '-- 큐레이터라고 남의 북마크가 보이지는 않는다'
rollback;

\echo '-- anon은 아무것도 보지 못한다'
begin;
set local role anon;
select pg_temp.assert_eq(count(*), 0, 'anon에게 북마크가 보이지 않는다') from public.bookmarks;
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
select pg_temp.assert_eq(count(*), 0, '남의 북마크는 지워지지 않는다') from gone;
rollback;

\echo '-- update는 정책이 없어 한 행도 걸리지 않는다 (0 rows)'
-- 정책 없는 UPDATE는 예외가 아니라 "해당 행 없음"으로 거부된다.
-- 본인 북마크가 select에는 보이는 상태에서 0이 나와야 의미가 있다.
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_eq(count(*), 1, '본인 북마크는 select에 보인다') from public.bookmarks;
with changed as (
  update public.bookmarks set created_at = now() returning 1
)
select pg_temp.assert_eq(count(*), 0, '북마크 update는 정책이 없어 한 행도 걸리지 않는다') from changed;
rollback;

\echo '-- 본인 것은 지워진다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with gone as (
  delete from public.bookmarks returning 1
)
select pg_temp.assert_eq(count(*), 1, '본인 북마크는 지워진다') from gone;
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
select pg_temp.assert_eq(count(*), 1, '리뷰는 본인 것만 보인다 (제보자)') from public.place_reviews;
rollback;
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_eq(count(*), 1, '리뷰는 본인 것만 보인다 (큐레이터도 예외가 아니다)') from public.place_reviews;
rollback;

\echo '-- anon은 원본을 한 행도 못 본다'
begin;
set local role anon;
select pg_temp.assert_eq(count(*), 0, 'anon은 리뷰 원본을 한 행도 못 본다') from public.place_reviews;
\echo '-- 그래도 집계는 볼 수 있다 (good=1, bad=1)'
select pg_temp.assert_eq(good::bigint, 1, 'anon이 보는 집계의 good')
  from public.place_review_counts((select id from public.places where slug = 'naruteo'));
select pg_temp.assert_eq(bad::bigint, 1, 'anon이 보는 집계의 bad')
  from public.place_review_counts((select id from public.places where slug = 'naruteo'));
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
select pg_temp.assert_eq(count(*), 1, '평가를 바꿔도 행은 하나다') from public.place_reviews;
select pg_temp.assert_eq(max(value::text), 'normal', '바꾼 값이 반영됐다') from public.place_reviews;
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
select pg_temp.assert_eq(count(*), 1, '본인 검수 폴더에는 올라간다') from put;
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
select pg_temp.assert_eq(count(*), 0, 'storage update는 정책이 없어 한 행도 걸리지 않는다') from changed;
rollback;

\echo '-- 본인이 올린 것은 지울 수 있다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with gone as (
  delete from storage.objects returning 1
)
select pg_temp.assert_eq(count(*), 1, '본인이 올린 사진은 지울 수 있다') from gone;
rollback;

\echo '=== H-2. 큐레이터는 카페 사진 자리를 직접 다룬다 ==='
-- 관리자 운영 화면이 사진을 올리고 지우려면 사람 세션에 그 권한이 있어야 한다.
-- service_role 키를 앱에 들이는 대신 정책을 열었다(20260821060000).
-- 위 H의 "카페 사진 자리에는 직접 못 올린다"는 여전히 통과한다 — 그쪽 uid는
-- 큐레이터가 아니기 때문이다. 두 케이스가 함께 있어야 경계가 확인된다.
--
-- ⚠️ update·delete에 where 절을 쓰지 않는다. 컬럼을 참조하는 순간 SELECT 권한이
--    함께 필요해지는데 storage.objects에는 SELECT 정책이 없어(공개 버킷이라
--    읽기는 공개 URL로 한다) 조건에 맞는 행이 하나도 보이지 않는다. 그러면 정책이
--    막은 것과 구분되지 않는 0 rows가 나온다. 위 H의 테스트들이 같은 이유로
--    `returning 1`(컬럼이 아니라 상수)만 쓴다.
--    이 테이블에 남아 있는 행은 H가 커밋한 제보 사진 하나뿐이라 조건이 필요 없다.

\echo '-- 큐레이터는 <slug>/ 에 올릴 수 있다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
with put as (
  insert into storage.objects (bucket_id, name)
  values ('place-images', 'naruteo/큐레이터가올린사진.jpg')
  returning 1
)
select pg_temp.assert_eq(count(*), 1, '큐레이터는 <slug>/ 에 올릴 수 있다') from put;
rollback;

\echo '-- 큐레이터는 고칠 수 있다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
with changed as (
  update storage.objects set name = 'naruteo/이름을바꿨다.jpg' returning 1
)
select pg_temp.assert_eq(count(*), 1, '큐레이터는 사진을 고칠 수 있다') from changed;
rollback;

\echo '-- 큐레이터는 지울 수 있다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
with gone as (
  delete from storage.objects returning 1
)
select pg_temp.assert_eq(count(*), 1, '큐레이터는 사진을 지울 수 있다') from gone;
rollback;

\echo '-- 큐레이터도 다른 버킷으로는 옮기지 못한다 (with check)'
begin;
-- 버킷은 postgres로 만든다. storage.buckets는 RLS가 켜져 있고 정책이 없어
-- authenticated로는 만들 수 없다.
insert into storage.buckets (id, name, public) values ('other-bucket', 'other-bucket', false);
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
do $$
begin
  update storage.objects set bucket_id = 'other-bucket';
  raise exception 'FAIL: 큐레이터가 파일을 다른 버킷으로 옮겼다';
exception when insufficient_privilege then
  raise notice 'OK: place_images_curator_update의 with check가 막았다';
end $$;
rollback;

\echo '=== I. 버킷 설정 ==='
-- lib/photo-rules.ts의 MAX_PHOTO_BYTES·ALLOWED_MIME과 같은 값이어야 한다.
-- 어긋나면 사용자가 5MB를 다 올려보낸 뒤에 서버가 튕긴다.
select pg_temp.assert_eq(file_size_limit, 5242880, '버킷 크기 상한이 5MB다')
  from storage.buckets where id = 'place-images';
select pg_temp.assert_eq(array_to_string(allowed_mime_types, ','),
                         'image/jpeg,image/png,image/webp',
                         '버킷이 받는 형식이 셋이다')
  from storage.buckets where id = 'place-images';
select pg_temp.assert_eq(public::text, 'true', 'place-images는 공개 버킷이다')
  from storage.buckets where id = 'place-images';

\echo '=== J. 브라우저에만 있던 규칙이 DB에도 있는가 ==='
-- 2026-08-23 보안 감사가 연 절이다 (docs/security-audit-2026-08-23/README.md).
-- anon 키는 브라우저에 그대로 나가므로 lib/submissions.ts를 거치지 않고 PostgREST를
-- 직접 부를 수 있다. 아래 여섯 가지가 **그때도 막히는지**를 본다.
--
-- ⚠️ 막는 것만 적지 않는다. 마지막의 "정상 제보는 여전히 들어간다"가 없으면
--    전부 거부하는 정책을 넣어도 이 절이 통과한다.

\echo '-- profiles는 익명에게 한 행도 보이지 않는다'
begin;
set local role anon;
select pg_temp.assert_eq(count(*), 0, 'anon에게 profiles가 보이지 않는다') from public.profiles;
rollback;

\echo '-- 로그인해도 남의 profile은 보이지 않는다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_eq(count(*), 1, '본인 profile 하나만 보인다') from public.profiles;
rollback;

\echo '-- 큐레이터는 제보자 닉네임을 읽어야 하므로 전부 본다 (lib/admin/reports.ts)'
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_eq(count(*), 2, '큐레이터에게는 profiles가 전부 보인다') from public.profiles;
rollback;

\echo '-- 네이버가 아닌 링크는 거부된다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reports (naver_place_url) values ('https://evil.example.com/phish');
  raise exception 'FAIL: 네이버가 아닌 링크가 들어갔다';
exception when check_violation then raise notice 'OK: naver_place_url_check가 막았다';
end $$;
\echo '-- 서브도메인이 붙은 진짜 네이버 링크는 통과한다'
do $$
begin
  insert into public.place_reports (naver_place_url) values ('https://m.place.naver.com/place/123');
  raise notice 'OK: m.place.naver.com은 통과한다';
end $$;
rollback;

\echo '-- 2000자를 넘는 메모는 거부된다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reports (naver_place_url, note)
  values ('https://naver.me/longNote', repeat('가', 2001));
  raise exception 'FAIL: 2001자 메모가 들어갔다';
exception when check_violation then raise notice 'OK: note_length가 막았다';
end $$;
rollback;

\echo '-- 사진 6장은 거부된다 (MAX_PHOTOS = 5)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
declare v_photos text[];
begin
  select array_agg('https://test.supabase.co/storage/v1/object/public/place-images/submissions/22222222-2222-2222-2222-222222222222/' || g || '.jpg')
    into v_photos from generate_series(1, 6) g;
  insert into public.place_reports (naver_place_url, photos)
  values ('https://naver.me/sixPhotos', v_photos);
  raise exception 'FAIL: 사진 6장이 들어갔다';
exception when check_violation then raise notice 'OK: photos_count가 막았다';
end $$;
rollback;

\echo '-- 검수 컬럼을 미리 채워 보낼 수 없다'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reports (naver_place_url, reviewed_by)
  values ('https://naver.me/fakeReview', '11111111-1111-1111-1111-111111111111');
  raise exception 'FAIL: 검수자를 스스로 채워 넣었다';
exception when insufficient_privilege then
  raise notice 'OK: place_reports_insert_own의 with check가 막았다';
end $$;
rollback;

\echo '-- 남의 검수 폴더 사진을 자기 제보에 담을 수 없다'
-- 공개 버킷이라 URL만 알면 열린다. "가리킬 수 있는 자리"를 정책이 정한다.
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reports (naver_place_url, photos)
  values ('https://naver.me/stolenPhoto',
          array['https://test.supabase.co/storage/v1/object/public/place-images/submissions/11111111-1111-1111-1111-111111111111/theirs.jpg']);
  raise exception 'FAIL: 남의 사진을 담았다';
exception when insufficient_privilege then
  raise notice 'OK: own_submission_photos가 막았다';
end $$;
rollback;

\echo '-- 정상 제보는 여전히 들어간다 (1 row)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
with put as (
  insert into public.place_reports (naver_place_url, note, photos)
  values ('https://naver.me/stillWorks', '멀쩡한 제보입니다',
          array['https://test.supabase.co/storage/v1/object/public/place-images/submissions/22222222-2222-2222-2222-222222222222/ok.jpg'])
  returning 1
)
select pg_temp.assert_eq(count(*), 1, '규칙을 지킨 제보는 그대로 들어간다') from put;
rollback;

\echo '=== K. 검수 전 사진 20장 상한 ==='
-- 정책에 있는데 테스트가 없던 자리다 (20260820135828).
-- H가 커밋해 둔 사진 한 장이 이미 있으므로 19장을 더 채우면 20장이 된다.
--
-- ⚠️ 한 장씩 넣는다. `insert ... select generate_series`로 한 문장에 몰면
--    submission_photo_count()가 stable이라 문장 시작 시점의 스냅샷을 보고 전부
--    통과한다. supabase-js는 파일마다 요청을 따로 보내므로 한 장씩이 실제 모양이다.
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
declare i int;
begin
  for i in 1..19 loop
    insert into storage.objects (bucket_id, name)
    values ('place-images',
            'submissions/22222222-2222-2222-2222-222222222222/fill' || i || '.jpg');
  end loop;
  raise notice 'OK: 20장까지는 올라간다';
end $$;
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('place-images', 'submissions/22222222-2222-2222-2222-222222222222/over.jpg');
  raise exception 'FAIL: 21장째가 올라갔다';
exception when insufficient_privilege then
  raise notice 'OK: submission_photo_count가 21장째를 막았다';
end $$;
rollback;

\echo '=== L. anon에게 열려 있던 RPC ==='
-- is_curator는 "이 uuid가 큐레이터인가"를 통째로 답한다. profiles를 잠가도 이쪽이
-- 열려 있으면 같은 것을 물어볼 수 있다 (20260823000002).
--
-- ⚠️ `revoke ... from anon`만으로는 막히지 않는다. 함수의 EXECUTE는 PUBLIC에 붙고
--    anon이 그것을 상속하므로 `from public, anon`이라야 한다. 이 테스트가 그 차이를
--    잡는다.
begin;
set local role anon;
do $$
begin
  perform public.is_curator('11111111-1111-1111-1111-111111111111');
  raise exception 'FAIL: anon이 is_curator를 불렀다';
exception when insufficient_privilege then
  raise notice 'OK: anon에게서 is_curator가 회수됐다';
end $$;
rollback;

\echo '-- 로그인 사용자는 계속 부를 수 있어야 한다 (정책이 쓴다)'
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_eq(
         public.is_curator('11111111-1111-1111-1111-111111111111')::text, 'true',
         'authenticated는 is_curator를 계속 부른다');
rollback;

\echo '-- 집계 RPC는 anon에게 열린 채로 남는다 (로그아웃 상세 화면이 쓴다)'
begin;
set local role anon;
select pg_temp.assert_eq(good::bigint, 1, 'anon은 place_review_counts를 계속 부른다')
  from public.place_review_counts((select id from public.places where slug = 'naruteo'));
rollback;
