-- ============================================================================
--  카공맵 — 장소 리뷰 (good / normal / bad)
-- ----------------------------------------------------------------------------
--  2026-08-20에 scope에 들어왔다. docs/scope.md가 "제보·리뷰는 여전히 제외"로
--  못박아 뒀던 것을 뒤집은 것이고, 근거는 그 문서의 변경 이력에 있다.
--
--  bookmarks와 같은 모양이다 — 사용자별 데이터이고, PK가 (user_id, place_id)라
--  한 사람이 한 장소에 하나만 남긴다. 다른 점은 고칠 값(value)이 있다는 것
--  하나뿐이고, 그래서 여기에는 bookmarks에 없는 UPDATE 정책이 있다.
--
--  ⚠️ 리뷰는 places의 큐레이션 값(work_fit·noise·last_verified)을 바꾸지 않는다.
--     환경 라벨은 운영자가 매기고, 리뷰는 그것과 별개인 사용자 신호다.
-- ============================================================================

create type public.place_review_value as enum ('good', 'normal', 'bad');


create table public.place_reviews (
  -- 소유자 컬럼 이름이 테이블마다 다르다 (profiles.id, place_submissions.submitted_by,
  -- bookmarks.user_id). 여기는 bookmarks와 같은 user_id다.
  user_id     uuid  not null default auth.uid()
                    references auth.users(id) on delete cascade,

  -- 앱 키는 slug지만 FK는 uuid다. slug가 nullable이라 참조 무결성을 못 주기
  -- 때문이며, 변환은 lib/place-id.ts가 맡는다 (bookmarks와 같은 이유).
  place_id    uuid  not null
                    references public.places(id) on delete cascade,

  value       public.place_review_value  not null,

  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  -- 한 사람이 한 장소에 하나. 평가를 바꾸는 것은 새 행이 아니라 update다.
  primary key (user_id, place_id)
);

comment on table public.place_reviews is
  '사용자가 장소에 남긴 평가. 1인 1건. 본인만 읽고 쓴다 — 집계는 place_review_counts()로만 노출된다.';

-- PK가 (user_id, place_id) 순서라 place_id 단독 조회는 못 탄다.
-- place_review_counts()와 places 삭제 시 cascade가 이 인덱스를 쓴다.
create index place_reviews_place_id_idx
  on public.place_reviews (place_id);

create trigger place_reviews_set_updated_at
  before update on public.place_reviews
  for each row
  execute function public.set_updated_at();


-- ─── RLS ────────────────────────────────────────────────────────────────────
--  네 명령을 한 번에 설계한다 (CLAUDE.md — Supabase RLS).
--  auth.uid()는 (select auth.uid())로 감싼다. 그래야 플래너가 행마다가 아니라
--  구문당 한 번 평가한다.

alter table public.place_reviews enable row level security;

-- SELECT — 본인 것만.
-- **큐레이터도 예외가 아니다.** 누가 어디에 bad를 눌렀는지는 운영에 필요한
-- 정보가 아니고, 개인이 식별되는 순간 솔직한 평가가 사라진다.
-- 남에게 보여줄 것은 집계뿐이고 그것은 아래 함수가 맡는다.
create policy "place_reviews_select_own"
  on public.place_reviews
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- INSERT — 소유자 컬럼을 남의 uid로 넣지 못하게 막는다.
-- default auth.uid()가 있어도 클라이언트가 값을 실어 보내면 default가 무시되므로
-- with check가 실질적인 방어선이다.
create policy "place_reviews_insert_own"
  on public.place_reviews
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- UPDATE — 평가를 바꾸는 경로다 (good → normal).
-- using은 "어떤 행을 고칠 수 있나", with check는 "고친 결과가 허용되나"로 서로
-- 다른 질문이라 둘 다 건다. with check가 없으면 본인 행의 user_id를 남에게
-- 넘겨 남의 이름으로 평가를 남길 수 있다.
create policy "place_reviews_update_own"
  on public.place_reviews
  for update
  to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- DELETE — 평가 해제. 상태 컬럼으로 대신하지 않는다.
-- 취소한 평가를 남겨둘 이유가 없고, 남기면 그것도 사용자 데이터가 된다.
create policy "place_reviews_delete_own"
  on public.place_reviews
  for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ─── 집계 ───────────────────────────────────────────────────────────────────
--  화면에는 "좋아요 3 · 보통 1 · 별로 0"만 필요하다. 그 숫자를 위해 테이블을
--  열면 누가 무엇을 눌렀는지가 통째로 따라 나오므로, 집계만 내놓는 함수 하나로
--  가른다. security definer라 위 select 정책을 통과하지 않고 전체를 센다.

create or replace function public.place_review_counts(p_place_id uuid)
returns table (good integer, normal integer, bad integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where r.value = 'good')::integer,
    count(*) filter (where r.value = 'normal')::integer,
    count(*) filter (where r.value = 'bad')::integer
  from public.place_reviews r
  where r.place_id = p_place_id;
$$;

comment on function public.place_review_counts(uuid) is
  '장소 하나의 리뷰 집계. place_reviews를 직접 열지 않으려고 둔 유일한 공개 창구다.';

-- 로그아웃 상태에서도 상세가 열리므로 anon도 집계를 본다.
revoke all    on function public.place_review_counts(uuid) from public;
grant  execute on function public.place_review_counts(uuid) to anon, authenticated;
