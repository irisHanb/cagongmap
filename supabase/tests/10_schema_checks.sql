\set ON_ERROR_STOP on
\echo '=== 1. 시드 적재 ==='
select count(*)                                       as seeded,
       count(*) filter (where status = 'published') as published
  from public.places;

\echo '=== 2. anon은 published만 본다 ==='
insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, status)
values ('숨김카페', '서울 송파구 어딘가 1', 37.51, 127.10, false, '09:00', '18:00', 'draft');
set local role anon;
select count(*) as visible_to_anon from public.places;
reset role;
select count(*) as visible_to_owner from public.places;

\echo '=== 3. published인데 핵심 속성이 비면 거부 ==='
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, status)
  values ('불완전', '서울 송파구 어딘가 2', 37.51, 127.10,
          false, '09:00', '18:00', 'published');
  raise exception 'FAIL: 제약이 통과되어 버렸다';
exception when check_violation then
  raise notice 'OK: places_published_requires_core가 막았다';
end $$;

\echo '=== 4. 24시간이 아닌데 영업시간이 없으면 거부 ==='
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, status)
  values ('시간없음', '서울 송파구 어딘가 3', 37.51, 127.10, false, 'draft');
  raise exception 'FAIL: 제약이 통과되어 버렸다';
exception when check_violation then
  raise notice 'OK: places_hours_required가 막았다';
end $$;

\echo '=== 5. 시간 형식 / 좌표 범위 ==='
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time)
  values ('형식오류', '서울 송파구 어딘가 4', 37.51, 127.10, false, '9:00', '18:00');
  raise exception 'FAIL: 시간 형식이 통과되어 버렸다';
exception when check_violation then raise notice 'OK: open_time 정규식이 막았다';
end $$;
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time)
  values ('좌표오류', '서울 송파구 어딘가 5', 12.3, 127.10, false, '09:00', '18:00');
  raise exception 'FAIL: 좌표 범위가 통과되어 버렸다';
exception when check_violation then raise notice 'OK: lat 범위가 막았다';
end $$;

\echo '=== 5-1. photos는 https URL 목록만 받는다 ==='
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, photos)
  values ('사진형식', '서울 송파구 어딘가 5-1', 37.51, 127.10, false, '09:00', '18:00',
          array['not-a-url']);
  raise exception 'FAIL: photos 형식이 통과되어 버렸다';
exception when check_violation then raise notice 'OK: places_photos_https가 막았다';
end $$;
do $$
declare
  v_photos text[];
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, photos)
  values ('사진정상', '서울 송파구 어딘가 5-2', 37.51, 127.10, false, '09:00', '18:00',
          array['https://example.com/a.jpg', 'https://example.com/b.jpg'])
  returning photos into v_photos;
  raise notice 'OK: 여러 장 저장됨 (%장)', cardinality(v_photos);
end $$;

\echo '=== 6. naver_place_url 중복 등록 방지 ==='
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h,
                            open_time, close_time, naver_place_url)
  values ('중복', '서울 송파구 어딘가 6', 37.51, 127.10, false, '09:00', '18:00',
          'https://map.naver.com/p/entry/place/1747832649');
  raise exception 'FAIL: 중복이 통과되어 버렸다';
exception when unique_violation then raise notice 'OK: 부분 unique 인덱스가 막았다';
end $$;

\echo '=== 7. 가입 트리거로 profiles 자동 생성 ==='
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'curator@test', '{"name":"큐레이터"}'),
       ('22222222-2222-2222-2222-222222222222', 'reporter@test', '{"name":"제보자"}');
select id, nickname, role from public.profiles order by nickname;
update public.profiles set role = 'curator' where id = '11111111-1111-1111-1111-111111111111';

\echo '=== 8. 제보: 신규 등록 → 승인 ==='
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_submissions (kind, payload, note) values (
  'new',
  jsonb_build_object(
    'name', '테스트 제보 카페', 'address', '서울 송파구 백제고분로 1', 'district', '송파구',
    'lat', 37.5079, 'lng', 127.1073, 'open_time', '10:00', 'close_time', '22:00',
    'is_24h', false, 'iced_americano_price', 4500,
    'outlet', 'many', 'wifi', true, 'noise', 'quiet', 'work_fit', 'good',
    'tags', jsonb_build_array('콘센트많음', '노트북작업')),
  '직접 방문해서 확인했습니다');

\echo '-- 제보자는 승인할 수 없어야 한다'
do $$
begin
  perform public.approve_submission((select id from public.place_submissions limit 1));
  raise exception 'FAIL: 비큐레이터가 승인했다';
exception when raise_exception then raise notice 'OK: %', sqlerrm;
end $$;

set local test.uid = '11111111-1111-1111-1111-111111111111';
select public.approve_submission(
         (select id from public.place_submissions where kind = 'new' limit 1)
       ) as new_place_id
\gset
select name,
       status,
       last_verified = current_date as verified_today,
       tags,
       created_by is not null       as has_reporter
  from public.places
 where id = :'new_place_id';

\echo '=== 9. 제보: 부분 수정 ==='
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_submissions (kind, place_id, payload, note)
values ('edit', :'new_place_id',
        jsonb_build_object('iced_americano_price', 5000, 'noise', 'normal'),
        '가격 인상됨');
set local test.uid = '11111111-1111-1111-1111-111111111111';
select public.approve_submission(
         (select id from public.place_submissions where kind = 'edit' limit 1));
\echo '-- name/tags는 그대로, 가격·소음만 바뀌어야 한다'
select name, iced_americano_price, noise, tags from public.places where id = :'new_place_id';

\echo '=== 10. payload에 금지 키가 있으면 거부 ==='
do $$
begin
  insert into public.place_submissions (kind, payload)
  values ('new', jsonb_build_object('name', 'x', 'status', 'published'));
  raise exception 'FAIL: 금지 키가 통과되어 버렸다';
exception when check_violation then raise notice 'OK: submissions_payload_keys가 막았다';
end $$;

\echo '=== 11. 폐업 신고 ==='
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_submissions (kind, place_id, payload, note)
values ('closed', :'new_place_id', '{}'::jsonb, '문 닫았습니다');
set local test.uid = '11111111-1111-1111-1111-111111111111';
select public.reject_submission(
  (select id from public.place_submissions where kind = 'closed' limit 1), '확인 필요');
select kind, status, review_note from public.place_submissions order by created_at;

\echo '=== 12. updated_at 트리거 ==='
select updated_at > created_at as updated_at_moved from public.places where id = :'new_place_id';
