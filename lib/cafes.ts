import { supabase } from '@/lib/supabase';
import type { Cafe, NoiseLevel, OutletLevel, WorkFit } from '@/types/cafe';

/**
 * ★ 데이터 접근 계층 (교체 지점)
 *
 * 컴포넌트는 카페 데이터를 반드시 이 파일을 통해서만 얻는다. 원본이 JSON에서
 * Supabase places 테이블로 바뀐 지금도 컴포넌트는 한 줄도 건드리지 않았다 —
 * 이 구조를 열어둔 이유가 그것이다.
 *
 * data/cafes.json은 더 이상 런타임 원본이 아니다. 시드 마이그레이션
 * (supabase/migrations/20260814000003_seed_places.sql)을 만드는 입력으로만 남는다.
 *
 * 자세한 배경은 docs/db-schema.md 참고.
 */

/**
 * places의 컬럼 중 앱이 쓰는 것만 고른다.
 * '*'를 쓰면 status·work_policy·created_by처럼 화면과 무관한 값까지 넘어온다.
 *
 * 한 줄 리터럴로 둔다. 문자열을 이어붙이면 supabase-js가 select 결과 타입을
 * 추론하지 못하고 GenericStringError로 떨어진다.
 */
const COLUMNS =
  'id, slug, name, address, lat, lng, naver_place_url, open_time, close_time, is_24h, iced_americano_price, outlet, wifi, noise, work_fit, tags, last_verified';

/**
 * published 행만 조회하므로 outlet·wifi·noise·work_fit·last_verified는 반드시 채워져
 * 있다 — places_published_requires_core 제약이 DB에서 보장한다. 그래서 non-null로 둔다.
 */
interface PlaceRow {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  naver_place_url: string | null;
  open_time: string | null;
  close_time: string | null;
  is_24h: boolean;
  iced_americano_price: number | null;
  outlet: OutletLevel;
  wifi: boolean;
  noise: NoiseLevel;
  work_fit: WorkFit;
  tags: string[];
  last_verified: string;
}

function toCafe(row: PlaceRow): Cafe {
  return {
    // 앱의 키는 slug다('naruteo'). 제보로 등록돼 아직 slug가 없는 카페는 uuid로 버틴다.
    id: row.slug ?? row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    naver_place_url: row.naver_place_url,
    // 24시간 영업이면 시간이 비어 있다. places_hours_required가 그 반대 경우를 막으므로
    // is_24h=false인데 여기가 빈 문자열이 되는 일은 없다.
    open_time: row.open_time ?? '',
    close_time: row.close_time ?? '',
    is_24h: row.is_24h,
    iced_americano_price: row.iced_americano_price,
    outlet: row.outlet,
    wifi: row.wifi,
    noise: row.noise,
    work_fit: row.work_fit,
    tags: row.tags,
    last_verified: row.last_verified,
  };
}

export async function getCafes(): Promise<Cafe[]> {
  const { data, error } = await supabase
    .from('places')
    .select(COLUMNS)
    // RLS가 이미 published만 열어주지만, 나중에 큐레이터 세션이 붙어도 지도에는
    // 공개된 카페만 나와야 하므로 조건을 명시한다.
    .eq('status', 'published')
    .order('slug')
    .returns<PlaceRow[]>();

  if (error) {
    throw new Error(`카페 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return data.map(toCafe);
}

export async function getCafeById(id: string): Promise<Cafe | undefined> {
  const { data, error } = await supabase
    .from('places')
    .select(COLUMNS)
    .eq('status', 'published')
    .eq('slug', id)
    .returns<PlaceRow[]>()
    .maybeSingle();

  if (error) {
    throw new Error(`카페를 불러오지 못했습니다 (${id}): ${error.message}`);
  }

  return data ? toCafe(data) : undefined;
}
