-- ============================================================================
--  카공맵 — places.photos
-- ----------------------------------------------------------------------------
--  카페 사진 URL을 여러 장 담는다. 파일은 저장하지 않는다 (mvp-decisions.md 3절:
--  사진을 직접 호스팅하지 않는다).
--
--  주의 — 이 컬럼을 채울 때 지켜야 하는 두 가지:
--
--  1. 저작권. mvp-decisions.md 3절은 "사진은 넣지 않는다"를 결정으로 두고
--     상세를 naver_place_url로 넘겼다. 이 컬럼은 그 결정을 다시 연 것이므로,
--     실제로 화면에 띄우기 전에 출처와 이용 조건을 정해야 한다.
--  2. 카카오맵 API 응답에서 가져온 URL을 넣지 않는다. 응답 데이터의 별도 저장은
--     약관 위반이며 차단이 실제로 집행된다 (mvp-decisions.md 크롤링 금지).
--
--  기존 9곳은 건드리지 않는다. not null + default '{}'이므로 기존 행은 빈 배열이
--  되고, 삭제되거나 값이 바뀌는 행은 없다.
-- ============================================================================

alter table public.places
  add column photos text[] not null default '{}';

-- 파일이 아니라 URL을 담는 컬럼이라는 것을 스키마에 박아둔다.
-- URL에 인코딩되지 않은 공백은 올 수 없으므로, 공백으로 이어 붙여 한 번에 검사한다.
alter table public.places
  add constraint places_photos_https check (
    cardinality(photos) = 0
    or array_to_string(photos, ' ') ~ '^https://\S+( https://\S+)*$'
  );

comment on column public.places.photos is
  '카페 사진 URL 목록. 파일을 직접 호스팅하지 않는다. 카카오맵 API 응답에서 온 URL 금지.';
