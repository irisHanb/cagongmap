-- ============================================================================
--  카공맵 — is_curator의 anon 회수를 실제로 먹게 한다
-- ----------------------------------------------------------------------------
--  20260823034122의 5번이 이렇게 적혀 있었다.
--
--    revoke all on function public.is_curator(uuid) from anon;
--
--  **이 줄은 아무 일도 하지 않는다.** 함수는 만들어질 때 `EXECUTE`가 `PUBLIC`에
--  붙고, `anon`은 그것을 상속한다. `anon`에게 따로 준 적이 없으므로 `anon`에서
--  회수할 것도 없다 — 상속분은 그대로 남는다. 적용한 뒤 advisor가 여전히
--  `is_curator can be executed by the anon role`을 띄워서 알았다.
--
--  같은 마이그레이션의 `handle_new_user`는 `from public, anon, authenticated`라
--  제대로 빠졌다. 한 파일 안에서 갈린 이유가 그것 하나다.
--
--  ⚠️ **`revoke ... from anon`만 쓰지 않는다. `public`을 함께 적는다.**
--     이 저장소의 다른 revoke는 전부 `from public, anon` 꼴이다(20260820113048,
--     20260820135828). 그 형태가 맞다.
--
--  정책은 깨지지 않는다. `is_curator`를 보는 정책 여덟 개가 전부 `to authenticated`이고
--  (places · place_reports · place_edit_requests · storage.objects), 정의자 함수
--  안의 호출(`resolve_reviewer`)은 소유자 권한으로 돈다.
-- ============================================================================

revoke all    on function public.is_curator(uuid) from public, anon;
grant  execute on function public.is_curator(uuid) to authenticated;


-- ─── 덤: set_updated_at의 search_path ───────────────────────────────────────
--
--  advisor가 계속 띄우던 마지막 한 줄이다. security **invoker**라 실제 위험은
--  낮지만, 받아들이기로 한 경고가 목록에 쌓이면 목록 자체를 안 보게 된다.
--  이 함수는 NEW만 건드리므로 search_path가 빈 값이어도 된다.
--
--  트리거는 함수 이름에 묶이므로 `create or replace`로 바꿔도 다시 붙일 것이 없다.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
