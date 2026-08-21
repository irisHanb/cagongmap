import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * ★ 관리자 판정은 여기 하나뿐이다
 *
 * 기준은 `profiles.role`이다. **관리자 이메일 환경변수를 두지 않는다** — 이유가 둘 있다.
 *
 *  1. 카카오 이메일은 선택 동의라 세션에 없을 수 있다. 이메일로 막으면 동의 항목이
 *     바뀌는 날 본인도 잠긴다.
 *  2. DB 쪽 판정이 이미 `public.is_curator()` 하나로 모여 있다 — 두 제보 테이블과
 *     `places`의 RLS, 승인·반려 RPC 넷이 전부 그것을 본다. 앱이 다른 기준으로
 *     판정하면 "화면은 열렸는데 저장이 거부되는" 상태가 생긴다.
 *
 * 이 파일은 **서버 전용이다.** `lib/supabase-server.ts`가 쿠키를 읽으므로 클라이언트
 * 컴포넌트에서 import하면 빌드가 깨진다. (`lib/bookmarks.ts`가 브라우저 전용인 것과 대칭)
 */

/** `user_role` enum 중 관리자로 치는 값. `public.is_curator()`와 같은 목록이어야 한다 */
const CURATOR_ROLES = ['curator', 'admin'] as const;

type CuratorRole = (typeof CURATOR_ROLES)[number];

export interface Curator {
  id: string;
  nickname: string | null;
  role: CuratorRole;
}

/**
 * 지금 요청의 큐레이터. 아니면 null.
 *
 * `cache`로 감싼 이유는 한 요청 안에서 레이아웃과 페이지가 각각 부르기 때문이다.
 * 감싸지 않으면 `getUser()`(auth 서버 왕복)와 profiles 조회가 화면마다 두세 번 돈다.
 * React의 `cache`는 요청 단위라 사용자 사이에 새지 않는다.
 */
export const getCurator = cache(async (): Promise<Curator | null> => {
  const supabase = await createServerSupabase();

  // getSession()이 아니라 getUser()다. 전자는 쿠키의 JWT를 검증 없이 그대로 믿는다.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, role')
    .eq('id', data.user.id)
    .maybeSingle<{ id: string; nickname: string | null; role: string }>();

  if (!profile) return null;
  if (!CURATOR_ROLES.includes(profile.role as CuratorRole)) return null;

  return { id: profile.id, nickname: profile.nickname, role: profile.role as CuratorRole };
});

/**
 * 큐레이터가 아니면 던진다. **서버 액션의 첫 줄에 둔다.**
 *
 * ⚠️ 서버 액션은 `app/admin/layout.tsx`의 가드 뒤에 있지 않다. 별도 POST
 *    엔드포인트로 직접 호출할 수 있으므로 레이아웃을 거치지 않는다. 액션마다 이
 *    한 줄을 빠뜨리면 로그인한 아무나 카페를 만들 수 있게 된다 — RLS가 2차
 *    방어선으로 남아 실제로 DB는 거부하겠지만, 그때 사용자가 보는 것은
 *    "권한이 없습니다"가 아니라 날것의 Postgres 오류다.
 */
export async function requireCurator(): Promise<Curator> {
  const curator = await getCurator();
  if (!curator) {
    throw new Error('관리자만 할 수 있는 작업입니다');
  }
  return curator;
}

/**
 * **관리자 페이지의 첫 줄.** 큐레이터가 아니면 그 자리에서 404를 낸다.
 *
 * ⚠️ 레이아웃의 가드만으로는 부족하다. Next는 레이아웃과 페이지를 **동시에** 렌더하므로,
 *    레이아웃이 `notFound()`를 던져도 페이지는 이미 자기 몫을 렌더한 뒤다. 화면에는
 *    404가 뜨지만 **페이지가 만든 RSC 페이로드가 그 응답에 함께 실린다.**
 *    (2026-08-21에 로그아웃 상태로 `/admin/places`를 받아 확인했다 — 카페 이름과
 *    주소가 응답 본문에 들어 있었다)
 *
 *    그때 새어 나온 값이 published 카페뿐이었던 것은 조회가 방문자의 세션으로 돌아
 *    RLS가 막아 준 덕이다. 즉 **방어선이 RLS 하나뿐이었다.** 페이지가 아예 렌더되지
 *    않아야 그 의존이 사라진다.
 */
export async function guardAdminPage(): Promise<Curator> {
  const curator = await getCurator();
  if (!curator) notFound();
  return curator;
}
