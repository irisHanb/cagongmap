-- ============================================================================
--  카공맵 — 사진 경로 제약을 제대로 조인다 (세 테이블 공통)
-- ----------------------------------------------------------------------------
--  바로 앞 두 마이그레이션에서 `array_to_string(photos, ' ') ~ '^\S+( \S+)*$'`로
--  공백을 막으려 했는데, 이 방법으로는 **원소 안의 공백을 못 잡는다.** 구분자로 쓴
--  공백과 값 안의 공백이 이어붙인 문자열에서 구별되지 않기 때문이다.
--
--    array['a b.jpg'] → 'a b.jpg' → 'a' + ' b.jpg'로 읽혀 통과한다.
--
--  빈 구분자로 이어붙이면 그 문제가 사라진다. 구분자가 없으니 남은 공백은 전부
--  값 안의 것이다.
--
--    array_to_string(photos, '') !~ '\s'
--
--  빈 문자열도 함께 막는다. 경로가 ''이면 공개 URL이 버킷 루트를 가리키고 화면에는
--  깨진 이미지가 뜬다.
--
--  세 테이블(places·place_reports·place_edit_requests)에 같은 규칙을 건다.
--  카페 사진이든 검수 전 제보 사진이든 같은 버킷의 경로이므로 규칙도 하나여야 한다.
-- ============================================================================

alter table public.places
  drop constraint places_photos_paths;

alter table public.places
  add constraint places_photos_paths check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, '') !~ '\s'
      and array_to_string(photos, '') !~ '://'
      and not ('' = any (photos))
    )
  );

alter table public.place_reports
  drop constraint place_reports_photos_paths;

alter table public.place_reports
  add constraint place_reports_photos_paths check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, '') !~ '\s'
      and array_to_string(photos, '') !~ '://'
      and not ('' = any (photos))
    )
  );

alter table public.place_edit_requests
  drop constraint place_edit_requests_photos_paths;

alter table public.place_edit_requests
  add constraint place_edit_requests_photos_paths check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, '') !~ '\s'
      and array_to_string(photos, '') !~ '://'
      and not ('' = any (photos))
    )
  );
