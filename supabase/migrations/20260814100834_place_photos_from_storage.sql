-- ============================================================================
--  카공맵 — place-images 버킷의 사진을 places.photos에 연결
-- ----------------------------------------------------------------------------
--  Storage 버킷 place-images(public)에 올라간 파일 9장을 slug로 맞춰 붙인다.
--  파일명 → slug 매핑은 사람이 확인했다 (crestown/samgsunggyo는 파일명 오타,
--  howp는 하우피 송리단길로 확인).
--
--  update만 한다 — 기존 행을 지우거나 photos 외의 컬럼을 바꾸지 않는다.
--  where photos = '{}' 조건으로, 이미 사진이 붙은 행은 건드리지 않는다.
--
--  주의: 이 URL들은 카카오맵 API 응답이 아니라 직접 올린 파일이다.
--  다만 mvp-decisions.md 3절 "사진을 직접 호스팅하지 않는다"와는 어긋나므로,
--  화면에 노출하기 전에 그 결정을 먼저 갱신해야 한다.
-- ============================================================================

update public.places p
set photos = array[
  'https://palzceynjixnbqjsagpq.supabase.co/storage/v1/object/public/place-images/' || m.file
]
from (values
  ('cafe-manarang',            'manarang.jpeg'),
  ('cresstown-jamsil',         'crestown.jpeg'),
  ('haupi-songridangil',       'howp.jpeg'),
  ('naruteo',                  'naruteo.jpeg'),
  ('starbucks-jamsil-station', 'starbucks_jamsil.jpeg'),
  ('starbucks-samsunggyo',     'starbucks_samgsunggyo.jpeg'),
  ('starbucks-seokchon-lake',  'starbucks_lake.jpeg'),
  ('terarosa-posco',           'terarosa_posco.JPG'),
  ('twosome-seokchongobun',    'twosome_seokchon_gobun.jpeg')
) as m(slug, file)
where p.slug = m.slug
  and cardinality(p.photos) = 0;
