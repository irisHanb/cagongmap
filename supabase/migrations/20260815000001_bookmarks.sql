-- ============================================================================
--  카공맵 — 북마크
-- ----------------------------------------------------------------------------
--  2026-08-15에 scope에 들어왔다. 원래 mvp-decisions.md 3절의 제외 항목이었고,
--  로그인이 붙은 뒤에도 "딸려오지 않는다"고 못박아 뒀던 기능이다. 뒤집은 기록은
--  docs/scope.md 변경 이력에 있다.
--
--  places와 달리 이 테이블은 처음부터 사용자별 데이터다. anon 키가 브라우저에
--  그대로 나가므로 RLS를 켜지 않으면 남의 북마크를 누구나 읽고 지울 수 있다.
-- ============================================================================

create table public.bookmarks (
  -- 소유자 컬럼 이름이 테이블마다 다르다. profiles는 id, place_submissions는
  -- submitted_by, 여기는 user_id다. 정책을 쓸 때 이름을 가정하지 말 것.
  user_id     uuid          not null default auth.uid()
                            references auth.users(id) on delete cascade,

  -- 앱이 카페를 부르는 키는 slug지만, FK는 uuid로 건다. slug는 nullable이라
  -- (제보로 등록돼 큐레이터가 아직 붙이지 않은 카페) 참조 무결성을 못 준다.
  -- slug ↔ uuid 변환은 lib/bookmarks.ts가 맡는다.
  place_id    uuid          not null
                            references public.places(id) on delete cascade,

  created_at  timestamptz   not null default now(),

  -- 같은 카페를 두 번 저장하는 것을 PK가 막는다. 별도 unique index가 필요 없고,
  -- "내 북마크 목록"(user_id로 시작하는 조회)이 이 인덱스를 그대로 탄다.
  primary key (user_id, place_id)
);

comment on table public.bookmarks is
  '사용자가 저장한 장소. 본인만 읽고 쓴다.';

-- PK가 (user_id, place_id) 순서라 place_id 단독 조회는 못 탄다.
-- places 삭제 시 cascade가 이 인덱스를 쓴다.
create index bookmarks_place_id_idx
  on public.bookmarks (place_id);


-- ─── RLS ────────────────────────────────────────────────────────────────────
--  네 명령을 한 번에 설계한다. 나중에 하나씩 붙이면 어느 동작이 왜 막혀 있는지
--  아무도 모르게 된다 (CLAUDE.md — Supabase RLS).

alter table public.bookmarks enable row level security;

-- auth.uid()는 (select auth.uid())로 감싼다. 감싸야 플래너가 행마다가 아니라
-- 구문당 한 번 평가한다. 저장소의 기존 정책이 전부 이 형태다.

-- SELECT — 본인 것만. 남이 어디를 저장했는지는 보이지 않는다.
-- 큐레이터도 예외가 아니다. 운영에 필요한 정보가 아니다.
create policy "bookmarks_select_own"
  on public.bookmarks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- INSERT — 소유자 컬럼을 남의 uid로 넣지 못하게 막는다.
-- default auth.uid()가 있어도 클라이언트가 값을 실어 보내면 default가 무시되므로
-- with check가 실질적인 방어선이다.
create policy "bookmarks_insert_own"
  on public.bookmarks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- UPDATE 정책은 일부러 만들지 않는다. 이 테이블에 고칠 값이 없다 —
-- (user_id, place_id)는 PK고 created_at은 기록이다. 북마크 해제는 delete다.
-- 정책이 없는 명령은 거부되므로 update는 전부 막힌 상태가 된다. 의도한 것이다.

-- DELETE — 북마크 해제. 상태 컬럼으로 대신하지 않는다.
-- 해제한 북마크를 남겨둘 이유가 없고, 남기면 그것도 사용자 데이터가 된다.
create policy "bookmarks_delete_own"
  on public.bookmarks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
