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

\echo '=== 5-1. photos는 버킷 경로만 받는다 (URL 금지) ==='
-- 카페 이미지는 전부 place-images 버킷을 쓴다. URL을 담으면 프로젝트 ref가 데이터에
-- 박히고, 외부 CDN 이미지가 섞여 들어올 길도 열린다.
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, photos)
  values ('사진형식', '서울 송파구 어딘가 5-1', 37.51, 127.10, false, '09:00', '18:00',
          array['https://example.com/a.jpg']);
  raise exception 'FAIL: URL이 통과되어 버렸다';
exception when check_violation then raise notice 'OK: places_photos_paths가 막았다';
end $$;
do $$
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, photos)
  values ('사진공백', '서울 송파구 어딘가 5-1b', 37.51, 127.10, false, '09:00', '18:00',
          array['a b.jpg']);
  raise exception 'FAIL: 공백이 통과되어 버렸다';
exception when check_violation then raise notice 'OK: 공백이 막혔다';
end $$;
do $$
declare
  v_photos text[];
begin
  insert into public.places (name, address, lat, lng, is_24h, open_time, close_time, photos)
  values ('사진정상', '서울 송파구 어딘가 5-2', 37.51, 127.10, false, '09:00', '18:00',
          array['naruteo.jpeg', 'submissions/22222222-2222-2222-2222-222222222222/b.jpg'])
  returning photos into v_photos;
  raise notice 'OK: 여러 장 저장됨 (%장)', cardinality(v_photos);
end $$;

\echo '-- 시드 9곳도 경로로 바뀌어 있어야 한다'
select count(*) filter (where array_to_string(photos, ' ') like '%://%') as urls_left,
       min(photos[1]) as sample
  from public.places
 where cardinality(photos) > 0;

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

\echo '=== 8. 새 장소 제보 → 승인 ==='
set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_reports (naver_place_url, photos, note)
values ('https://naver.me/testReport',
        array['https://test.supabase.co/storage/v1/object/public/place-images/submissions/22222222-2222-2222-2222-222222222222/a.jpg'],
        '직접 방문해서 확인했습니다');

\echo '-- 큐레이터가 카페를 먼저 만든다 (제보에는 이만한 정보가 없다)'
set local test.uid = '11111111-1111-1111-1111-111111111111';
insert into public.places (name, address, district, lat, lng, naver_place_url,
                           open_time, close_time, is_24h, iced_americano_price,
                           outlet, wifi, noise, work_fit, tags,
                           status, last_verified, verified_by)
values ('테스트 제보 카페', '서울 송파구 백제고분로 1', '송파구', 37.5079, 127.1073,
        'https://naver.me/testReport', '10:00', '22:00', false, 4500,
        'many', true, 'quiet', 'good', array['콘센트많음', '노트북작업'],
        'published', current_date, '11111111-1111-1111-1111-111111111111')
returning id as new_place_id
\gset

\echo '-- 제보자는 승인할 수 없어야 한다'
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  perform public.approve_place_report(
    (select id from public.place_reports limit 1),
    (select id from public.places where naver_place_url = 'https://naver.me/testReport'));
  raise exception 'FAIL: 비큐레이터가 승인했다';
exception when raise_exception then raise notice 'OK: %', sqlerrm;
end $$;

\echo '-- 세션 없는 호출(대시보드 SQL·운영 스크립트)은 승인자를 인자로 지정한다'
-- 그 경로에서는 auth.uid()가 NULL이다. 이것이 없으면 승인이 영영 통과하지 못한다.
set local test.uid = '';
do $$
begin
  perform public.approve_place_report(
    (select id from public.place_reports limit 1),
    (select id from public.places where naver_place_url = 'https://naver.me/testReport'),
    '22222222-2222-2222-2222-222222222222');  -- 큐레이터가 아닌 사람
  raise exception 'FAIL: 비큐레이터를 승인자로 지정했다';
exception when raise_exception then raise notice 'OK: %', sqlerrm;
end $$;

\echo '-- 로그인한 비큐레이터는 인자로 남을 사칭할 수 없다'
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  perform public.approve_place_report(
    (select id from public.place_reports limit 1),
    (select id from public.places where naver_place_url = 'https://naver.me/testReport'),
    '11111111-1111-1111-1111-111111111111');  -- 큐레이터 uuid를 넣어도
  raise exception 'FAIL: 사칭이 통했다';
exception when raise_exception then raise notice 'OK: %', sqlerrm;
end $$;

set local test.uid = '';
select public.approve_place_report(
         (select id from public.place_reports limit 1), :'new_place_id',
         '11111111-1111-1111-1111-111111111111');
\echo '-- 승인되면 제보가 등록된 카페를 가리킨다'
select status,
       place_id = :'new_place_id' as linked,
       reviewed_at is not null    as reviewed,
       reviewed_by = '11111111-1111-1111-1111-111111111111' as reviewer_recorded
  from public.place_reports;

\echo '-- 승인이 사진까지 붙인다 (파일을 옮기지 않으므로 경로가 그대로 온다)'
select photos from public.places where id = :'new_place_id';

\echo '-- 다시 승인하려 하면 거부된다 (사진이 두 번 붙지 않는다)'
do $$
begin
  perform public.approve_place_report(
    (select id from public.place_reports limit 1),
    (select id from public.places where naver_place_url = 'https://naver.me/testReport'),
    '11111111-1111-1111-1111-111111111111');
  raise exception 'FAIL: 이미 처리된 제보가 또 통과했다';
exception when raise_exception then raise notice 'OK: %', sqlerrm;
end $$;

\echo '=== 9. 정보 수정 요청 → 승인 ==='
\echo '-- 확인일을 어제로 돌려놓고 시작한다'
update public.places set last_verified = current_date - 1 where id = :'new_place_id';

set local test.uid = '22222222-2222-2222-2222-222222222222';
insert into public.place_edit_requests (place_id, note)
values (:'new_place_id', '가격 인상됨');

set local test.uid = '11111111-1111-1111-1111-111111111111';
select public.approve_edit_request(
         (select id from public.place_edit_requests limit 1));
\echo '-- 승인은 확인일을 오늘로 옮긴다. 카페 정보 자체는 사람이 고친다'
select p.name,
       p.last_verified = current_date as verified_today,
       r.status
  from public.places p, public.place_edit_requests r
 where p.id = :'new_place_id';

\echo '=== 10. 제보 사진은 place-images 공개 URL만 받는다 ==='
-- places.photos는 경로, 제보 쪽은 URL이다. 담는 목적이 달라서 모양도 다르다.
-- 어느 쪽이든 외부 CDN 이미지는 들어올 수 없다.
set local test.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into public.place_reports (naver_place_url, photos)
  values ('https://naver.me/withUrlPhoto',
          array['https://example.com/photo.jpg']);
  raise exception 'FAIL: 외부 URL이 들어갔다';
exception when check_violation then raise notice 'OK: place_reports_photos_urls가 막았다';
end $$;
do $$
begin
  insert into public.place_reports (naver_place_url, photos)
  values ('https://naver.me/withPathPhoto',
          array['submissions/22222222-2222-2222-2222-222222222222/a.jpg']);
  raise exception 'FAIL: 경로가 들어갔다 (URL이어야 한다)';
exception when check_violation then raise notice 'OK: 경로는 거부됐다';
end $$;

\echo '-- 내용 없는 수정 요청도 거부된다'
do $$
begin
  insert into public.place_edit_requests (place_id, note)
  values ((select id from public.places limit 1), '   ');
  raise exception 'FAIL: 빈 수정 요청이 들어갔다';
exception when check_violation then raise notice 'OK: has_content 제약이 막았다';
end $$;

\echo '=== 11. 같은 대상에 대기 중 요청은 하나뿐 ==='
-- 9번에서 낸 요청은 승인됐으므로(부분 인덱스는 pending만 본다) 새로 하나 낸다.
insert into public.place_edit_requests (place_id, note)
values (:'new_place_id', '대기 중인 요청');
do $$
begin
  insert into public.place_edit_requests (place_id, note)
  values ((select id from public.places
            where naver_place_url = 'https://naver.me/testReport'), '또 보냅니다');
  raise exception 'FAIL: 대기 중 요청이 두 건 쌓였다';
exception when unique_violation then raise notice 'OK: 부분 unique 인덱스가 막았다';
end $$;

\echo '=== 12. updated_at 트리거 ==='
select updated_at > created_at as updated_at_moved from public.places where id = :'new_place_id';

\echo '=== 13. 제보의 가게 이름은 선택이되 빈 값은 못 들어간다 ==='
-- 2026-08-21 추가. 네이버 링크에서 상호를 뽑을 방법이 없어 제보자에게 직접 받는다.
-- 필수가 아니라는 것과, 그렇다고 공백을 받지는 않는다는 것 둘 다 확인한다.
insert into public.place_reports (naver_place_url, place_name)
values ('https://naver.me/withName', '나루터');
select place_name from public.place_reports where naver_place_url = 'https://naver.me/withName';

\echo '-- 비워도 된다 (선택 입력)'
insert into public.place_reports (naver_place_url)
values ('https://naver.me/withoutName');
select place_name is null as name_is_null
  from public.place_reports where naver_place_url = 'https://naver.me/withoutName';

\echo '-- 공백만 든 이름은 거부된다'
do $$
begin
  insert into public.place_reports (naver_place_url, place_name)
  values ('https://naver.me/blankName', '   ');
  raise exception 'FAIL: 공백만 든 가게 이름이 들어갔다';
exception when check_violation then raise notice 'OK: place_name check가 막았다';
end $$;

\echo '-- 100자를 넘기면 거부된다'
do $$
begin
  insert into public.place_reports (naver_place_url, place_name)
  values ('https://naver.me/longName', repeat('가', 101));
  raise exception 'FAIL: 101자짜리 가게 이름이 들어갔다';
exception when check_violation then raise notice 'OK: 길이 제한이 막았다';
end $$;
