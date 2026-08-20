-- ============================================================================
--  카공맵 — 제보 사진도 place-images 버킷의 공개 경로로
-- ----------------------------------------------------------------------------
--  카페 이미지는 전부 한 버킷을 쓴다. place_reports·place_edit_requests의
--  photo_paths(비공개 submission-images 경로)를 places.photos와 **같은 모양**으로
--  맞춘다 — 컬럼 이름도 photos, 값도 place-images 버킷의 공개 경로다.
--
--  얻는 것:
--   * 세 테이블이 같은 규칙을 쓴다. "사진 = place-images 경로" 하나만 기억하면 된다.
--   * 승인이 버킷 간 이동이 아니라 같은 버킷 안의 경로 변경으로 끝난다.
--     (submissions/<uid>/x.jpg → <slug>/x.jpg)
--
--  대가 — 2026-08-20에 뒤집은 결정이므로 적어 둔다:
--   * **검수 전 사진이 올라가는 즉시 공개 URL을 갖는다.** 경로를 알아야 열리지만
--     (uuid 파일명) 비공개 버킷과 달리 인증이 필요하지 않다.
--   * **로그인한 사용자가 공개 버킷에 파일을 쓸 수 있게 된다.** 그래서 정책으로
--     submissions/<본인 uid>/ 아래로만 제한하고, 버킷에 크기·형식 제한을 건다.
--     그 둘이 이 결정의 방어선이다.
-- ============================================================================

-- 공개 버킷에 사용자가 쓰게 되므로 제한을 건다. submission-images에 걸어 두었던
-- 것과 같은 값이다. 기존 파일에는 영향이 없다 — 업로드 시점에만 적용된다.
--
-- upsert인 이유: place-images는 대시보드에서 만들어진 버킷이라 마이그레이션에
-- 정의가 없었다. 새 환경에서는 여기서 만들어지고, 이미 있는 프로젝트에서는
-- 제한만 갱신된다. public은 건드리지 않는다 — 이미 공개 버킷이다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
   set file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;


-- ─── 컬럼 이름과 뜻 맞추기 ──────────────────────────────────────────────────

alter table public.place_reports       rename column photo_paths to photos;
alter table public.place_edit_requests rename column photo_paths to photos;

alter table public.place_reports
  rename constraint place_reports_photo_paths_check to place_reports_photos_paths;
alter table public.place_edit_requests
  rename constraint place_edit_requests_photo_paths_check to place_edit_requests_photos_paths;

comment on column public.place_reports.photos is
  'place-images 버킷의 오브젝트 경로. places.photos와 같은 규칙이며 검수 전에는 submissions/<uid>/ 아래에 있다.';
comment on column public.place_edit_requests.photos is
  'place-images 버킷의 오브젝트 경로. places.photos와 같은 규칙이며 검수 전에는 submissions/<uid>/ 아래에 있다.';


-- ─── storage 정책 ───────────────────────────────────────────────────────────
--  submission-images에 걸어 두었던 정책을 place-images로 옮긴다. 경로 규칙이
--  바뀌었으므로 폴더를 하나 더 들어간다 — submissions/<uid>/<파일>.
--
--  ⚠️ bucket_id 조건을 반드시 함께 건다. 빼면 모든 버킷에 적용된다.

drop policy if exists "submission_images_insert_own"           on storage.objects;
drop policy if exists "submission_images_select_own_or_curator" on storage.objects;
drop policy if exists "submission_images_delete_own"           on storage.objects;

-- INSERT — 본인 폴더(submissions/<uid>/)에만. 카페 사진이 놓이는 자리(<slug>/)에는
-- 쓸 수 없다. 승인된 사진을 옮기는 것은 service_role을 쓰는 운영 스크립트다.
create policy "place_images_insert_own_submission"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- DELETE — 제출 전에 잘못 고른 사진을 지울 수 있어야 한다. 승인돼 <slug>/ 아래로
-- 옮겨간 사진은 경로가 달라져 이 정책에 걸리지 않는다. 의도한 것이다.
create policy "place_images_delete_own_submission"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- SELECT 정책은 만들지 않는다. 공개 버킷이라 읽기는 정책이 아니라 공개 URL로
-- 이뤄진다. 정책을 만들면 "읽기를 통제하고 있다"는 인상만 주고 실제로는 아니다.

-- UPDATE 정책도 만들지 않는다. 파일마다 새 uuid를 쓰므로 덮어쓸 일이 없다.
-- 빠뜨린 것이 아니라 설계다.
