-- ============================================================================
--  카공맵 — 승인자 판정을 "세션이 없으면"으로 넓힌다
-- ----------------------------------------------------------------------------
--  바로 앞(20260820135828)에서 auth.role() = 'service_role'로 좁혔는데, 그 조건이
--  **대시보드 SQL 편집기를 함께 막았다.** 직접 연결이라 auth.uid()도 auth.role()도
--  NULL이기 때문이다. 그래서 지금은 service_role 키가 있어야만 승인이 되는 상태였고,
--  문서에 적어둔 "대시보드에서 승인한다"도 함께 틀려 있었다.
--
--  조건을 "세션이 없으면 인자를 쓴다"로 넓힌다. 세션 없는 호출은 셋뿐이다 —
--  service_role 키(운영 스크립트), 대시보드 SQL 편집기, psql. 셋 다 이미 RLS 밖의
--  경로다.
--
--  일반 사용자가 이 길로 들어올 수 없는 이유는 그대로다:
--   * 함수 execute는 authenticated에만 grant돼 있다(anon은 revoke).
--   * Supabase가 주는 authenticated JWT에는 언제나 sub가 있으므로 auth.uid()가
--     먼저 잡히고, 인자는 무시된다 — 로그인한 비큐레이터의 사칭이 막히는 지점이다.
-- ============================================================================

create or replace function public.resolve_reviewer(p_reviewer uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reviewer uuid;
begin
  -- 세션이 있으면 무조건 그 사람이다. 인자는 세션이 없을 때만 쓰인다.
  v_reviewer := coalesce(auth.uid(), p_reviewer);

  if v_reviewer is null or not public.is_curator(v_reviewer) then
    raise exception '큐레이터만 제보를 처리할 수 있습니다';
  end if;

  return v_reviewer;
end;
$$;

comment on function public.resolve_reviewer(uuid) is
  '승인·반려의 주체를 정한다. 세션이 있으면 그 사람, 세션이 없을 때만 인자를 쓴다.';
