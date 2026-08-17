import type { Cafe } from '@/types/cafe';
import { PLACE_COLUMNS, toCafe, type PlaceRow } from '@/lib/cafes';
import { getBrowserSupabase } from '@/lib/supabase-browser';

/**
 * ★ 북마크 데이터 접근 계층
 *
 * lib/cafes.ts와 같은 규칙이다. 컴포넌트는 bookmarks 테이블을 직접 건드리지 않는다.
 *
 * 다른 점은 클라이언트가 다르다는 것 하나다. 북마크는 사용자별 데이터라 세션이
 * 있어야 RLS를 통과하므로 supabase-browser를 쓴다. 그래서 **이 파일은 브라우저
 * 전용이다** — 서버 컴포넌트에서 부르면 세션이 없어 빈 목록이 돌아온다.
 *
 * places row → Cafe 변환은 lib/cafes.ts의 toCafe()를 그대로 빌려 쓴다.
 */

/** Cafe.id는 slug다. slug가 없는 카페만 uuid가 그대로 들어온다 (lib/cafes.ts toCafe) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 앱 키(slug) → places.id(uuid).
 *
 * bookmarks.place_id가 uuid FK라 저장·해제 때 한 번 변환이 필요하다. slug로 FK를
 * 걸면 이 변환이 없어지지만, slug가 nullable이라 참조 무결성을 못 준다
 * (supabase/migrations/20260815000001_bookmarks.sql 주석 참고).
 *
 * 목록 조회에는 쓰지 않는다 — 그쪽은 join 한 번으로 끝난다.
 */
async function resolvePlaceId(cafeId: string): Promise<string> {
  if (UUID_RE.test(cafeId)) return cafeId;

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

interface BookmarkRow {
  place_id: string;
  places: PlaceRow | null;
}

/**
 * 저장한 카페 목록. 최근에 저장한 것이 위로 온다.
 *
 * RLS가 본인 행만 돌려주므로 where user_id = ... 를 쓰지 않는다. 조건을 한 번 더
 * 적으면 정책이 느슨해져도 화면이 멀쩡해 보여서 오히려 문제를 가린다.
 *
 * places가 null로 오는 경우가 있다 — 저장해 둔 카페가 draft·hidden·closed로
 * 바뀌면 places RLS가 그 행을 감춘다. 그때는 목록에서 빼되 북마크는 지우지 않는다.
 * 다시 published가 되면 되살아난다.
 */
export async function getBookmarkedCafes(): Promise<Cafe[]> {
  const { data, error } = await getBrowserSupabase()
    .from('bookmarks')
    .select(`place_id, places(${PLACE_COLUMNS})`)
    .order('created_at', { ascending: false })
    .returns<BookmarkRow[]>();

  if (error) {
    throw new Error(`북마크를 불러오지 못했습니다: ${error.message}`);
  }

  return data.flatMap((row) => (row.places ? [toCafe(row.places)] : []));
}

export async function addBookmark(cafeId: string): Promise<void> {
  // user_id는 넣지 않는다. 컬럼 default가 auth.uid()이고, 값을 실어 보내면
  // bookmarks_insert_own의 with check가 검사할 거리를 우리가 만들어 주는 셈이다.
  const { error } = await getBrowserSupabase()
    .from('bookmarks')
    .insert({ place_id: await resolvePlaceId(cafeId) });

  if (error) {
    throw new Error(`북마크를 저장하지 못했습니다: ${error.message}`);
  }
}

export async function removeBookmark(cafeId: string): Promise<void> {
  const { error } = await getBrowserSupabase()
    .from('bookmarks')
    .delete()
    .eq('place_id', await resolvePlaceId(cafeId));

  if (error) {
    throw new Error(`북마크를 해제하지 못했습니다: ${error.message}`);
  }
}
