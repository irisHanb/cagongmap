-- ============================================================================
--  카공맵 — 큐레이터가 카페 사진을 직접 다룰 수 있게 한다
-- ----------------------------------------------------------------------------
--  지금까지 `place-images` 버킷에 쓸 수 있는 것은 두 갈래뿐이었다.
--
--   * 로그인 사용자 → `submissions/<본인 uid>/` 아래만 (검수 전 제보 사진)
--   * service_role  → 어디든 (운영 스크립트)
--
--  카페 사진이 놓이는 자리(`<slug>/`)는 **아무 사람 계정으로도 쓸 수 없었다.**
--  그래서 사진을 바꾸려면 대시보드 Storage에 직접 올리고 경로를 복사해
--  `places.photos` 배열을 손으로 고쳐야 했다.
--
--  관리자 운영 화면이 그 일을 화면 안에서 하게 되면서, 큐레이터 세션에 그 권한이
--  필요해졌다. **service_role 키를 앱에 들이는 대신 정책을 연다** — 2026-08-21에
--  승인 경로에서 그 키를 걷어낸 것과 같은 방향이다(20260821012109). 서버 액션이
--  사용자 세션(anon 키)으로 돌고, 판정은 계속 RLS가 한다.
--
--  ⚠️ 여기서 여는 것은 **권한의 경계**이고, "어떤 파일을 지울 것인가"는 앱의
--     판단이다. 앱은 `places.photos`에서 뺀 경로 중 `<slug>/` 아래 것만 storage에서
--     지우고 `submissions/` 아래 것은 파일을 남긴다 — 제보 row가 그 URL을 여전히
--     가리키기 때문이다(검수 이력). 그 규칙을 정책으로 두 번 적지 않는다.
--     정책에 적으면 나중에 정리 작업 하나가 필요해질 때마다 마이그레이션을 써야 한다.
-- ============================================================================

-- INSERT — 새 사진을 올린다. 경로는 앱이 `<slug>/<uuid>.<ext>`로 만든다.
create policy "place_images_curator_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and public.is_curator((select auth.uid()))
  );

-- UPDATE — supabase-js의 `upload(..., { upsert: true })`와 `move`가 쓴다.
-- using(고칠 수 있는 행)과 with check(고친 결과)를 둘 다 건다. with check가 없으면
-- 큐레이터가 파일을 다른 버킷으로 옮기는 결과를 막지 못한다.
create policy "place_images_curator_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'place-images'
    and public.is_curator((select auth.uid()))
  )
  with check (
    bucket_id = 'place-images'
    and public.is_curator((select auth.uid()))
  );

-- DELETE — 뺀 사진을 그 자리에서 치운다. 없으면 지도에서 사라진 사진이 버킷에
-- 영원히 남고, prune 스크립트는 60분 규칙과 service_role 키가 있어야 돈다.
create policy "place_images_curator_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-images'
    and public.is_curator((select auth.uid()))
  );

-- SELECT 정책은 여전히 만들지 않는다. 공개 버킷이라 읽기는 정책이 아니라 공개
-- URL로 이뤄지고(20260820121437의 주석), 관리자 화면도 `places.photos`에 담긴
-- 경로로 읽지 버킷을 훑지 않는다. 목록이 필요한 것은 prune 스크립트 하나이고
-- 그쪽은 service_role이다.
--
-- ⚠️ `alter table storage.objects enable row level security`와 `grant`를 쓰지 않는다.
--    이미 켜져 있고 이미 grant돼 있으며, alter table은 소유자만 되므로 깨진다.
