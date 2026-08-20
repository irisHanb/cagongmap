import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * 앱 키(slug) → places.id(uuid).
 *
 * 앱이 카페를 부르는 키는 slug('naruteo')지만, 사용자 데이터 테이블의 FK는 전부
 * uuid다. slug가 nullable이라(제보로 등록돼 큐레이터가 아직 붙이지 않은 카페)
 * 참조 무결성을 못 주기 때문이다.
 *
 * 원래 lib/bookmarks.ts 안에 있었는데, 리뷰와 제보도 같은 변환이 필요해지면서
 * 여기로 뺐다. 변환 코드가 둘이 되면 두 경로가 반드시 어긋난다.
 *
 * 세션 클라이언트를 쓴다. 세션 없는 클라이언트로 바꾸면 published가 아닌 카페를
 * 못 찾게 되고, 큐레이터가 draft 카페를 다루는 경로가 조용히 막힌다.
 *
 * 목록 조회에는 쓰지 않는다 — 그쪽은 join 한 번으로 끝난다.
 */

/** Cafe.id는 slug다. slug가 없는 카페만 uuid가 그대로 들어온다 (lib/cafes.ts toCafe) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function resolvePlaceId(cafeId: string): Promise<string> {
  if (isUuid(cafeId)) return cafeId;

  const { data, error } = await getBrowserSupabase()
    .from('places')
    .select('id')
    .eq('slug', cafeId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`카페를 찾지 못했습니다 (${cafeId}): ${error.message}`);
  }
  if (!data) {
    throw new Error(`카페를 찾지 못했습니다: ${cafeId}`);
  }

  return data.id;
}
