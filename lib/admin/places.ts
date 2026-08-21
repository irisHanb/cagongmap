import { requireCurator } from '@/lib/admin/guard';
import {
  EMPTY_PLACE_FORM,
  type PlaceFormValues,
  type PlacePayload,
  type PlaceStatus,
} from '@/lib/admin/place-form';
import { extensionFor, photoFilesReason } from '@/lib/photo-rules';
import { PLACE_IMAGE_BUCKET, placeImageUrl } from '@/lib/place-images';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * ★ 장소 관리 이음매 (서버 전용)
 *
 * `lib/cafes.ts`와 같은 규칙이다 — 컴포넌트는 `places` 테이블도 Storage도 직접
 * 건드리지 않는다. 다른 점 둘:
 *
 *  1. 세션 클라이언트를 쓴다. 큐레이터 RLS 정책이 세션을 봐야 통과한다.
 *  2. **status와 무관하게 전부 읽는다.** 공개 조회(`lib/cafes.ts`)는 published만
 *     보지만, 여기서 draft가 보이지 않으면 만들다 만 카페를 다시 찾을 방법이 없다.
 *
 * 사진 값의 모양에 주의한다. **`places.photos`는 경로다**(`naruteo/x.jpg`).
 * URL을 넣으면 check 제약이 거부한다. 화면에 그릴 URL은 `placeImageUrl()`로 만든다.
 */

/**
 * 목록용 컬럼. 한 줄 리터럴이어야 supabase-js가 타입을 추론한다.
 * `lib/cafes.ts`의 PLACE_COLUMNS를 그대로 쓰지 못하는 이유는 거기에 `status`와
 * `updated_at`이 없기 때문이다 — 공개 조회가 알 필요 없는 값이라 뺀 것이고,
 * 관리자 목록은 정확히 그 둘로 정렬하고 표시한다.
 */
const ADMIN_LIST_COLUMNS =
  'id, slug, name, address, status, work_fit, last_verified, photos, updated_at';

/** 폼용. 폼이 다루는 컬럼 전부다 */
const ADMIN_FORM_COLUMNS =
  'id, slug, name, address, district, lat, lng, naver_place_url, open_time, close_time, is_24h, iced_americano_price, outlet, wifi, noise, work_fit, work_policy, status, tags, last_verified, photos';

export interface AdminPlaceListItem {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  status: PlaceStatus;
  workFit: string | null;
  lastVerified: string | null;
  photoCount: number;
  /** 대표 사진의 공개 URL. 없으면 null */
  thumbnail: string | null;
  updatedAt: string;
}

interface ListRow {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  status: PlaceStatus;
  work_fit: string | null;
  last_verified: string | null;
  photos: string[] | null;
  updated_at: string;
}

export async function listPlaces(): Promise<AdminPlaceListItem[]> {
  // 조회에도 판정을 건다. 페이지가 guardAdminPage()를 빠뜨려도 데이터가 나가지 않게
  // 하는 뒷단이다 — RLS 하나에 기대지 않는다.
  await requireCurator();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('places')
    .select(ADMIN_LIST_COLUMNS)
    .order('updated_at', { ascending: false })
    .returns<ListRow[]>();

  if (error) {
    throw new Error(`장소를 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const photos = row.photos ?? [];
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      address: row.address,
      status: row.status,
      workFit: row.work_fit,
      lastVerified: row.last_verified,
      photoCount: photos.length,
      // 첫 장이 마커 썸네일이다. 목록에서도 같은 것을 보여줘야 어느 카페인지 안다.
      thumbnail: photos[0] ? placeImageUrl(photos[0]) : null,
      updatedAt: row.updated_at,
    };
  });
}

interface FormRow extends ListRow {
  district: string | null;
  lat: number;
  lng: number;
  naver_place_url: string | null;
  open_time: string | null;
  close_time: string | null;
  is_24h: boolean;
  iced_americano_price: number | null;
  outlet: string | null;
  wifi: boolean | null;
  noise: string | null;
  work_policy: string | null;
  tags: string[] | null;
}

export interface AdminPlaceDetail {
  id: string;
  name: string;
  values: PlaceFormValues;
  /** 버킷 경로. 화면에 그릴 때만 URL로 바꾼다 */
  photos: string[];
}

/** 수정 폼이 읽는다. 없으면 null — 페이지가 notFound()로 받는다 */
export async function getPlaceForEdit(id: string): Promise<AdminPlaceDetail | null> {
  await requireCurator();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('places')
    .select(ADMIN_FORM_COLUMNS)
    .eq('id', id)
    .maybeSingle<FormRow>();

  if (error) {
    throw new Error(`장소를 불러오지 못했습니다: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    photos: data.photos ?? [],
    values: {
      ...EMPTY_PLACE_FORM,
      slug: data.slug ?? '',
      name: data.name,
      address: data.address,
      district: data.district ?? '',
      naver_place_url: data.naver_place_url ?? '',
      lat: String(data.lat),
      lng: String(data.lng),
      is_24h: data.is_24h,
      open_time: data.open_time ?? '',
      close_time: data.close_time ?? '',
      iced_americano_price:
        data.iced_americano_price === null ? '' : String(data.iced_americano_price),
      outlet: data.outlet ?? '',
      // null(모름) · true · false 셋을 문자열로 구분한다. 빈 문자열이 "모름"이다.
      wifi: data.wifi === null ? '' : String(data.wifi),
      noise: data.noise ?? '',
      work_fit: data.work_fit ?? '',
      work_policy: data.work_policy ?? '',
      status: data.status,
      tags: (data.tags ?? []).join(', '),
      last_verified: data.last_verified ?? '',
    },
  };
}

/**
 * 카페를 만든다. 만들어진 행의 id와 slug를 돌려준다 — 사진 경로를 만들 때 필요하다.
 *
 * `created_by`를 여기서 채운다. 컬럼 default가 없어 넣지 않으면 null로 남는다.
 */
export async function insertPlace(payload: PlacePayload): Promise<{ id: string; slug: string | null }> {
  const curator = await requireCurator();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('places')
    .insert({ ...payload, photos: [], created_by: curator.id })
    .select('id, slug')
    .single<{ id: string; slug: string | null }>();

  if (error) throw new Error(translatePlaceError(error.code, error.message));
  return data;
}

export async function updatePlace(
  id: string,
  payload: PlacePayload,
): Promise<{ id: string; slug: string | null }> {
  await requireCurator();
  const supabase = await createServerSupabase();

  // photos는 여기서 건드리지 않는다. 사진은 업로드가 끝난 뒤 setPlacePhotos()가
  // 한 번에 쓴다 — 순서가 뒤집히면 방금 올린 파일을 가리키지 않는 배열이 남는다.
  const { data, error } = await supabase
    .from('places')
    .update(payload)
    .eq('id', id)
    .select('id, slug')
    .single<{ id: string; slug: string | null }>();

  if (error) throw new Error(translatePlaceError(error.code, error.message));
  return data;
}

/**
 * `places.photos`를 통째로 갈아끼운다.
 *
 * ⚠️ **승인 RPC보다 먼저 불러야 한다.** `approve_place_report()`·`approve_edit_request()`
 * 안의 `attach_submission_photos()`가 제보 사진을 이 배열에 **이어 붙이므로**, 이
 * 함수가 뒤에 오면 방금 붙은 사진을 덮어쓴다.
 */
export async function setPlacePhotos(id: string, paths: string[]): Promise<void> {
  await requireCurator();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from('places').update({ photos: paths }).eq('id', id);
  if (error) throw new Error(`사진 목록을 저장하지 못했습니다: ${error.message}`);
}

/**
 * 사진을 올리고 **경로**를 돌려준다.
 *
 * 경로는 `<slug>/<uuid>.<ext>`이고, slug가 아직 없으면 `<place-id>/…`를 쓴다.
 * 파일명에 원본 이름을 쓰지 않는 것은 제보 업로드와 같은 이유다 — 한글·공백·중복이
 * 그대로 키가 된다.
 *
 * URL이 아니라 경로를 돌려주는 이유는 저장할 컬럼이 경로를 담기 때문이다. URL을
 * 담으면 프로젝트 ref가 데이터에 박혀 프로젝트를 옮길 때 전부 죽는다
 * (`lib/place-images.ts`).
 */
export async function uploadPlacePhotos(
  folder: string,
  files: File[],
): Promise<string[]> {
  if (files.length === 0) return [];

  await requireCurator();

  const reason = photoFilesReason(files);
  if (reason) throw new Error(reason);

  const supabase = await createServerSupabase();
  const storage = supabase.storage.from(PLACE_IMAGE_BUCKET);

  const uploaded: string[] = [];
  for (const file of files) {
    const path = `${folder}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await storage.upload(path, file, { contentType: file.type });

    if (error) {
      // 세 번째 장에서 실패하면 앞의 둘이 버킷에 남는다. 되돌리고 던진다.
      await removePlacePhotos(uploaded);
      throw new Error(`사진을 올리지 못했습니다: ${error.message}`);
    }
    uploaded.push(path);
  }

  return uploaded;
}

/**
 * 버킷에서 파일을 지운다.
 *
 * **실패해도 던지지 않는다.** 여기서 던지면 저장은 이미 끝났는데 사용자에게는
 * 실패로 보인다. 남은 파일은 `scripts/prune-orphan-photos.mjs`가 걷어간다 —
 * `lib/submissions.ts`의 `removePhotos()`와 같은 규칙이다.
 *
 * 어떤 경로를 넘길지는 부르는 쪽이 정한다. `deletablePaths()`가 `submissions/`
 * 아래를 빼고 넘긴다(제보 row가 여전히 그 URL을 가리키기 때문이다).
 */
export async function removePlacePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase.storage.from(PLACE_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.warn('사진 파일을 지우지 못했습니다:', error.message);
  }
}

/**
 * Postgres 오류를 사람이 읽을 문구로.
 *
 * 폼이 먼저 검증하므로 여기까지 오는 것은 대개 **폼이 볼 수 없는 것** — 다른 카페와
 * 겹치는 slug나 네이버 URL — 이다. 제약 이름이 박힌 원문을 그대로 띄우면 무엇을
 * 고쳐야 하는지 알 수 없다.
 */
function translatePlaceError(code: string | undefined, message: string): string {
  if (code === '23505') {
    if (message.includes('naver_place_url')) {
      return '같은 네이버 링크를 쓰는 카페가 이미 있어요';
    }
    if (message.includes('slug')) {
      return '같은 slug를 쓰는 카페가 이미 있어요';
    }
    return '이미 같은 값을 쓰는 카페가 있어요';
  }
  if (code === '23514' && message.includes('published_requires_core')) {
    return '공개하려면 콘센트 · 와이파이 · 소음 · 작업 적합도 · 확인일이 채워져 있어야 해요';
  }
  return `저장하지 못했습니다: ${message}`;
}
