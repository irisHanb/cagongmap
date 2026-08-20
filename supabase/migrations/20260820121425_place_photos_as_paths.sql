-- ============================================================================
--  카공맵 — places.photos를 절대 URL에서 버킷 경로로
-- ----------------------------------------------------------------------------
--  지금까지 photos에는 이런 값이 들어 있었다.
--
--    https://palzceynjixnbqjsagpq.supabase.co/storage/v1/object/public/place-images/naruteo.jpeg
--
--  문제가 둘이다.
--
--  1. **프로젝트 ref가 데이터에 박힌다.** 프로젝트를 옮기면 9행을 전부 다시 써야 하고,
--     그때까지 화면은 죽은 URL을 가리킨다. 다른 곳은 전부 NEXT_PUBLIC_SUPABASE_URL
--     하나만 보고 있는데(next.config.ts의 remotePatterns까지) 여기만 예외였다.
--  2. **제약이 `^https://`뿐이라 어느 호스트든 통과했다.** 카카오맵 응답에서 온 URL을
--     넣지 않는다는 것은 구속력 있는 결정인데(docs/mvp-decisions.md 크롤링 금지),
--     그 결정을 DB가 거들지 못했다.
--
--  이제 경로만 담는다 — `naruteo.jpeg`. 공개 URL은 앱이 Storage SDK로 만든다
--  (lib/place-images.ts). 제보 사진(place_reports.photo_paths)이 이미 경로 모양이라
--  승인 때 옮겨 붙이는 것도 이 변경으로 자연스러워진다.
--
--  ⚠️ 버킷은 place-images 하나로 고정이다. 다른 버킷의 사진을 쓰려면 컬럼이 아니라
--     이 결정을 먼저 바꿔야 한다.
-- ============================================================================

-- 옛 제약(`^https://`)을 먼저 뗀다. 값을 먼저 바꾸려 하면 그 제약이 자기 자신을
-- 지키느라 update를 막는다 — 경로는 https로 시작하지 않기 때문이다.
alter table public.places
  drop constraint places_photos_https;

update public.places
   set photos = (
     select coalesce(
       array_agg(
         regexp_replace(
           photo,
           '^https?://[^/]+/storage/v1/object/public/place-images/',
           ''
         )
         order by ord
       ),
       '{}'
     )
     from unnest(photos) with ordinality as t(photo, ord)
   )
 where cardinality(photos) > 0;

-- URL을 막고(`://`), 공백도 막는다. 우리가 만드는 파일명은 uuid이거나 slug라
-- 공백이 들어올 일이 없고, 빈 문자열이 배열에 섞이는 것도 이걸로 걸린다.
alter table public.places
  add constraint places_photos_paths check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, ' ') ~ '^\S+( \S+)*$'
      and array_to_string(photos, ' ') !~ '://'
    )
  );

comment on column public.places.photos is
  'place-images 버킷의 오브젝트 경로 목록. URL이 아니다 — 공개 URL은 앱이 만든다(lib/place-images.ts). 카카오맵 API 응답에서 온 이미지는 넣지 않는다.';
