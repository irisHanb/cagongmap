-- ============================================================================
--  카공맵 — 옛 버킷을 가리키던 사진 경로를 비운다
-- ----------------------------------------------------------------------------
--  submission-images는 2026-08-20 오전에 만들었다가 같은 날 접은 버킷이다. 카페
--  관련 이미지는 전부 place-images 하나를 쓰기로 했고(20260820121437), 그 뒤로는
--  아무것도 올라가지 않는다.
--
--  그 버킷에 남아 있던 파일을 가리키는 경로가 대기 중 제보에 남아 있었다. 없는
--  파일을 가리키는 경로를 두면 승인 스크립트가 거기서 멈추므로 비운다. 제보 자체
--  (네이버 URL·메모)는 그대로 둔다 — 사진이 없다고 제보가 쓸모없어지지는 않는다.
--
--  ⚠️ **버킷 자체는 이 파일이 지우지 못한다.** Postgres가 storage 테이블의 직접
--     삭제를 트리거로 막는다("Direct deletion from storage tables is not allowed.
--     Use the Storage API instead."). 오브젝트가 고아가 되는 것을 막는 가드이므로
--     우회하지 않는다. 버킷은 대시보드(Storage → submission-images → Delete)나
--     Storage API로 지운다. 앱은 이 버킷을 더 이상 참조하지 않으므로, 남아 있어도
--     동작에는 영향이 없다.
-- ============================================================================

-- 승인된 요청의 사진은 이미 place-images의 `<slug>/` 아래로 옮겨졌으므로 건드리지
-- 않는다 — status와 경로 모양 둘 다로 좁힌다.
update public.place_reports
   set photos = '{}'
 where status = 'pending'
   and cardinality(photos) > 0
   and photos[1] not like 'submissions/%';

update public.place_edit_requests
   set photos = '{}'
 where status = 'pending'
   and cardinality(photos) > 0
   and photos[1] not like 'submissions/%';
