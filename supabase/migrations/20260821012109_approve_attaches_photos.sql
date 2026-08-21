-- ============================================================================
--  카공맵 — 승인이 사진까지 붙인다 (파일을 옮기지 않는다)
-- ----------------------------------------------------------------------------
--  사진을 `submissions/<uid>/`에서 `<slug>/`로 옮기던 것을 그만둔다.
--
--  옮기는 이유는 경로를 깔끔하게 두려는 것뿐이었는데, 그 대가로 **승인에
--  service_role 키가 필요했다.** 파일 이동은 Storage API를 거쳐야 하고 카페 사진
--  자리(`<slug>/`)는 정책이 사용자에게 열어주지 않기 때문이다.
--
--  옮기지 않으면 승인이 전부 SQL 안에서 끝난다. places.photos는 버킷 경로를 담을
--  뿐이고 `submissions/...`도 같은 버킷의 유효한 경로다 — 화면에서 열리는 것은
--  이미 확인했다.
--
--    select public.approve_place_report('<제보>', '<카페>', '<큐레이터>');
--
--  이 한 줄이면 사진이 붙고 상태가 바뀐다. 대시보드 SQL 편집기에서 그대로 된다.
--
--  대가 둘:
--   * 공개 URL에 업로더 uid가 남는다. 파일 정리는 덜 깔끔하다.
--   * 사진이 검수 폴더에 계속 있으므로, 업로드 상한(20장)을 그냥 세면 승인해도
--     자리가 비지 않는다. 그래서 **places가 이미 쓰고 있는 사진은 세지 않는다** —
--     상한의 뜻이 "검수를 통과하지 못한 채 쌓인 사진"이 된다.
-- ============================================================================

/**
 * 제보 사진(공개 URL)을 카페 사진(버킷 경로)으로 옮겨 붙인다.
 *
 * 이미 붙어 있는 경로는 다시 넣지 않는다 — 승인을 두 번 시도해도 같은 결과여야 한다.
 * 순서는 제보에 담긴 순서를 지킨다.
 */
create or replace function public.attach_submission_photos(
  p_place_id uuid,
  p_photos   text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged   text[];
  v_incoming text[];
  v_path     text;
begin
  if coalesce(cardinality(p_photos), 0) = 0 then
    return;
  end if;

  select photos into v_merged
    from public.places
   where id = p_place_id
     for update;

  -- 공개 URL → 버킷 경로. 담긴 순서를 지킨다.
  select coalesce(array_agg(
           regexp_replace(u, '^.*/storage/v1/object/public/place-images/', '')
           order by ord), '{}')
    into v_incoming
    from unnest(p_photos) with ordinality as t(u, ord);

  foreach v_path in array v_incoming
  loop
    if not (v_path = any (v_merged)) then
      v_merged := v_merged || v_path;
    end if;
  end loop;

  update public.places set photos = v_merged where id = p_place_id;
end;
$$;

revoke all on function public.attach_submission_photos(uuid, text[]) from public, anon, authenticated;


create or replace function public.approve_place_report(
  p_report_id uuid,
  p_place_id  uuid,
  p_reviewer  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
  r          public.place_reports;
begin
  select * into r
    from public.place_reports
   where id = p_report_id
     for update;

  if not found then
    raise exception '제보를 찾을 수 없습니다: %', p_report_id;
  end if;
  if r.status <> 'pending' then
    raise exception '이미 처리된 제보입니다 (status=%)', r.status;
  end if;
  if not exists (select 1 from public.places where id = p_place_id) then
    raise exception '연결할 카페를 찾을 수 없습니다: %', p_place_id;
  end if;

  perform public.attach_submission_photos(p_place_id, r.photos);

  update public.place_reports
     set status      = 'approved',
         place_id    = p_place_id,
         reviewed_by = v_reviewer,
         reviewed_at = now()
   where id = p_report_id;
end;
$$;

comment on function public.approve_place_report(uuid, uuid, uuid) is
  '제보를 승인해 카페에 연결하고 사진을 그 카페에 붙인다. 카페 생성 자체는 하지 않는다.';

create or replace function public.approve_edit_request(
  p_request_id uuid,
  p_reviewer   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := public.resolve_reviewer(p_reviewer);
  r          public.place_edit_requests;
begin
  select * into r
    from public.place_edit_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception '수정 요청을 찾을 수 없습니다: %', p_request_id;
  end if;
  if r.status <> 'pending' then
    raise exception '이미 처리된 요청입니다 (status=%)', r.status;
  end if;

  perform public.attach_submission_photos(r.place_id, r.photos);

  -- 메모는 자유 텍스트라 자동으로 반영할 구조화된 값이 없다. 실제 수정은 큐레이터가
  -- places를 직접 고치는 것이고, 여기서는 "사람이 다시 봤다"를 기록한다.
  update public.places
     set last_verified = current_date,
         verified_by   = v_reviewer
   where id = r.place_id;

  update public.place_edit_requests
     set status      = 'approved',
         reviewed_by = v_reviewer,
         reviewed_at = now()
   where id = p_request_id;
end;
$$;


-- ─── 업로드 상한의 기준을 바꾼다 ────────────────────────────────────────────
--  사진이 검수 폴더에 계속 남으므로, 그냥 세면 승인해도 자리가 비지 않는다.
--  places가 이미 쓰고 있는 사진은 검수를 통과한 것이므로 세지 않는다.
--
--  places를 훑지만 지금 9행이고, 스케일이 커지면 photos에 GIN 인덱스를 붙인다.

create or replace function public.submission_photo_count(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::integer
    from storage.objects o
   where o.bucket_id = 'place-images'
     and o.name like 'submissions/' || p_uid::text || '/%'
     and not exists (
       select 1 from public.places p where o.name = any (p.photos)
     );
$$;

comment on function public.submission_photo_count(uuid) is
  '아직 카페에 붙지 않은 검수 폴더 사진 수. storage 정책이 업로드 상한을 걸 때 쓴다.';
