-- ============================================================================
--  카공맵 — 제보·수정 요청의 photos는 공개 URL을 담는다
-- ----------------------------------------------------------------------------
--  places.photos와 이 두 테이블은 사진을 담는 목적이 다르다.
--
--   * places.photos        — 오래 남는다. 앱이 매번 읽어 화면에 그린다.
--                            → **경로**만 담는다. URL을 담으면 프로젝트 ref가
--                              데이터에 박혀, 프로젝트를 옮길 때 9행이 전부 죽는다.
--   * place_reports.photos — 검수하는 사람이 읽는다. 대시보드에서 값을 그대로
--     place_edit_requests    클릭해 사진을 열 수 있어야 한다.
--                            → **공개 URL**을 담는다. 경로만 있으면 검수자가
--                              매번 URL을 손으로 조립해야 한다.
--
--  제보는 검수가 끝나면 수명이 끝나는 데이터라, 프로젝트 ref가 박히는 대가를
--  치를 만하다. 승인될 때 사진은 경로로 바뀌어 places.photos로 옮겨간다
--  (scripts/approve-submission.mjs가 URL에서 경로를 되짚는다).
--
--  ⚠️ 기존 경로를 URL로 바꾸는 부분에 **프로젝트 URL이 하드코딩돼 있다.** SQL은
--     프로젝트 주소를 알 방법이 없기 때문이다. 일회성 데이터 이전이며
--     (20260814100834이 같은 이유로 같은 일을 했다), 앞으로 URL을 만드는 것은
--     앱이다(lib/place-images.ts). 다른 프로젝트에서는 이 부분이 0행에 걸린다.
-- ============================================================================

-- 옛 제약(`!~ '://'`)을 먼저 뗀다. 값을 먼저 바꾸려 하면 그 제약이 막는다.
alter table public.place_reports
  drop constraint place_reports_photos_paths;

alter table public.place_edit_requests
  drop constraint place_edit_requests_photos_paths;

-- 경로로 저장돼 있던 사진을 공개 URL로 바꾼다. 이미 URL인 행은 건드리지 않는다.
update public.place_reports
   set photos = (
     select coalesce(array_agg(
       'https://palzceynjixnbqjsagpq.supabase.co/storage/v1/object/public/place-images/' || p
       order by ord), '{}')
     from unnest(photos) with ordinality as t(p, ord)
   )
 where cardinality(photos) > 0
   and array_to_string(photos, ' ') !~ '://';

update public.place_edit_requests
   set photos = (
     select coalesce(array_agg(
       'https://palzceynjixnbqjsagpq.supabase.co/storage/v1/object/public/place-images/' || p
       order by ord), '{}')
     from unnest(photos) with ordinality as t(p, ord)
   )
 where cardinality(photos) > 0
   and array_to_string(photos, ' ') !~ '://';

-- 호스트는 검사하지 않는다(환경마다 다르다). 대신 **place-images 버킷의 공개
-- 객체 URL 모양**을 강제한다. 외부 CDN 이미지나 서명 URL은 이 모양이 아니다.
alter table public.place_reports
  add constraint place_reports_photos_urls check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, '') !~ '\s'
      and not ('' = any (photos))
      and array_to_string(photos, ' ')
          ~ '^https://\S+/storage/v1/object/public/place-images/\S+( https://\S+/storage/v1/object/public/place-images/\S+)*$'
    )
  );

alter table public.place_edit_requests
  add constraint place_edit_requests_photos_urls check (
    cardinality(photos) = 0
    or (
      array_to_string(photos, '') !~ '\s'
      and not ('' = any (photos))
      and array_to_string(photos, ' ')
          ~ '^https://\S+/storage/v1/object/public/place-images/\S+( https://\S+/storage/v1/object/public/place-images/\S+)*$'
    )
  );

comment on column public.place_reports.photos is
  'place-images 버킷의 공개 URL. 검수자가 대시보드에서 바로 열 수 있어야 해서 경로가 아니라 URL이다. 승인되면 경로로 바뀌어 places.photos로 옮겨간다.';
comment on column public.place_edit_requests.photos is
  'place-images 버킷의 공개 URL. 검수자가 대시보드에서 바로 열 수 있어야 해서 경로가 아니라 URL이다.';
