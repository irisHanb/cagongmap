import type { NoiseLevel, OutletLevel, WorkFit, WorkPolicy } from '@/types/cafe';

/**
 * ★ 장소 폼의 값 변환과 검증 — **순수 함수만 둔다**
 *
 * Supabase도 next/headers도 닿지 않는다. 그래야 폼(클라이언트)과 서버 액션이 같은
 * 함수를 쓰고, 테스트가 목 없이 돈다. 저장 경로에서 실수가 나기 쉬운 곳
 * — 빈 문자열과 null, 24시간 영업, published 제약 — 이 전부 여기 모여 있다.
 */

/**
 * `places.status`. `types/cafe.ts`에 두지 않은 이유는 `Cafe`가 이 값을 들고 다니지
 * 않기 때문이다 — 공개 조회는 published만 가져오므로 화면에 status라는 개념이 없다.
 * 이것을 아는 것은 관리자 화면뿐이다.
 */
export type PlaceStatus = 'draft' | 'published' | 'hidden' | 'closed';

export const PLACE_STATUS_LABEL: Record<PlaceStatus, string> = {
  draft: '작성 중',
  published: '공개',
  hidden: '숨김',
  closed: '폐업',
};

/**
 * 폼이 들고 있는 값. **전부 문자열이다** — `<input>`이 문자열을 주고, 숫자로 미리
 * 바꿔 두면 "비어 있음"과 "0"을 구분할 수 없게 된다. 숫자 변환은 payload를 만들 때
 * 한 번만 한다.
 *
 * `wifi`가 boolean이 아니라 문자열인 것도 같은 이유다. DB에서 nullable이라
 * 있음/없음/모름 셋을 구분해야 하는데 체크박스는 둘밖에 표현하지 못한다.
 */
export interface PlaceFormValues {
  slug: string;
  name: string;
  address: string;
  district: string;
  naver_place_url: string;
  lat: string;
  lng: string;
  is_24h: boolean;
  open_time: string;
  close_time: string;
  iced_americano_price: string;
  outlet: string;
  wifi: string;
  noise: string;
  work_fit: string;
  work_policy: string;
  status: PlaceStatus;
  /** 쉼표로 나눈다. 태그가 한 자릿수인 동안 칩 편집기를 만들 이유가 없다 */
  tags: string;
  /** `YYYY-MM-DD` */
  last_verified: string;
}

export interface PlacePayload {
  slug: string | null;
  name: string;
  address: string;
  district: string | null;
  lat: number;
  lng: number;
  naver_place_url: string | null;
  open_time: string | null;
  close_time: string | null;
  is_24h: boolean;
  iced_americano_price: number | null;
  outlet: OutletLevel | null;
  wifi: boolean | null;
  noise: NoiseLevel | null;
  work_fit: WorkFit | null;
  work_policy: WorkPolicy | null;
  status: PlaceStatus;
  tags: string[];
  last_verified: string | null;
}

export const EMPTY_PLACE_FORM: PlaceFormValues = {
  slug: '',
  name: '',
  address: '',
  district: '',
  naver_place_url: '',
  lat: '',
  lng: '',
  is_24h: false,
  open_time: '',
  close_time: '',
  iced_americano_price: '',
  outlet: '',
  wifi: '',
  noise: '',
  work_fit: '',
  work_policy: '',
  status: 'draft',
  tags: '',
  last_verified: '',
};

/** 빈 문자열은 null이다. 공백만 든 문자열도 마찬가지 */
function nullable(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

/**
 * `HH:mm`으로 맞춘다.
 *
 * `<input type="time">`이 대개 `HH:mm`을 주지만 step에 초가 들어가면 `HH:mm:ss`가
 * 온다. `places.open_time`은 정규식 check가 걸린 text 컬럼이라 초가 붙으면 그대로 거부된다.
 */
function normalizeTime(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text.slice(0, 5);
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** `평일, 콘센트 , 조용함` → `['평일', '콘센트', '조용함']` */
export function parseTags(value: string): string[] {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  return [...new Set(tags)];
}

/**
 * `status='published'`에 필요한데 비어 있는 항목의 **한국어 이름**.
 *
 * DB의 `places_published_requires_core`가 같은 것을 막지만, 거기까지 보내면 사용자가
 * 보는 것은 제약 이름이 박힌 Postgres 오류다. 무엇이 비었는지는 폼이 안다.
 */
export function missingForPublished(values: PlaceFormValues): string[] {
  const required: [keyof PlaceFormValues, string][] = [
    ['outlet', '콘센트'],
    ['wifi', '와이파이'],
    ['noise', '소음'],
    ['work_fit', '작업 적합도'],
    ['last_verified', '확인일'],
  ];

  return required
    .filter(([key]) => String(values[key] ?? '').trim() === '')
    .map(([, label]) => label);
}

/**
 * 저장 전 검증. 통과하면 빈 배열, 걸리면 사람이 읽을 문장들.
 *
 * DB 제약과 겹치는 검사가 여럿이다. 겹치는 것이 낭비가 아닌 이유는, DB는 거부만 하고
 * **무엇을 어떻게 고쳐야 하는지는 말해 주지 않기** 때문이다.
 */
export function validatePlaceForm(values: PlaceFormValues): string[] {
  const errors: string[] = [];

  if (values.name.trim() === '') errors.push('이름을 넣어주세요');
  if (values.address.trim() === '') errors.push('주소를 넣어주세요');

  const lat = Number(values.lat);
  const lng = Number(values.lng);
  if (values.lat.trim() === '' || values.lng.trim() === '') {
    errors.push('지도에서 위치를 찍어주세요');
  } else if (Number.isNaN(lat) || Number.isNaN(lng)) {
    errors.push('좌표는 숫자여야 해요');
  } else if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    // DB의 check와 같은 범위다. 한반도 밖 좌표는 대개 위경도를 바꿔 넣은 실수다.
    errors.push('좌표가 국내 범위를 벗어났어요. 위도와 경도가 바뀌지 않았는지 확인해주세요');
  }

  if (!values.is_24h) {
    const open = normalizeTime(values.open_time);
    const close = normalizeTime(values.close_time);
    if (!open || !close) {
      errors.push('영업시간을 넣어주세요. 24시간 영업이면 그 항목을 켜주세요');
    } else if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      errors.push('영업시간은 HH:mm 형식이어야 해요');
    }
  }

  const price = values.iced_americano_price.trim();
  if (price !== '' && (!/^\d+$/.test(price) || Number(price) < 0)) {
    errors.push('아메리카노 가격은 0 이상의 정수여야 해요');
  }

  const naver = values.naver_place_url.trim();
  if (naver !== '' && !/^https:\/\/\S+$/.test(naver)) {
    // place_reports와 달리 places는 https이기만 하면 된다(네이버가 아닌 링크도 허용).
    errors.push('네이버 링크는 https://로 시작해야 해요');
  }

  if (values.last_verified.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(values.last_verified.trim())) {
    errors.push('확인일은 YYYY-MM-DD 형식이어야 해요');
  }

  if (values.status === 'published') {
    const missing = missingForPublished(values);
    if (missing.length > 0) {
      errors.push(`공개하려면 ${missing.join(' · ')}을(를) 채워야 해요`);
    }
  }

  return errors;
}

/** 검증을 통과한 폼 값을 DB에 넣을 모양으로. `validatePlaceForm()`을 먼저 부른다 */
export function buildPlacePayload(values: PlaceFormValues): PlacePayload {
  return {
    slug: nullable(values.slug),
    name: values.name.trim(),
    address: values.address.trim(),
    district: nullable(values.district),
    lat: Number(values.lat),
    lng: Number(values.lng),
    naver_place_url: nullable(values.naver_place_url),
    // 24시간 영업이면 시간을 비운다. DB 제약은 값이 남아 있어도 통과시키지만,
    // 남겨 두면 화면이 "24시간 영업 · 09:00-18:00"을 그리게 된다.
    open_time: values.is_24h ? null : normalizeTime(values.open_time),
    close_time: values.is_24h ? null : normalizeTime(values.close_time),
    is_24h: values.is_24h,
    iced_americano_price:
      values.iced_americano_price.trim() === '' ? null : Number(values.iced_americano_price),
    outlet: (nullable(values.outlet) as OutletLevel | null) ?? null,
    wifi: values.wifi === '' ? null : values.wifi === 'true',
    noise: (nullable(values.noise) as NoiseLevel | null) ?? null,
    work_fit: (nullable(values.work_fit) as WorkFit | null) ?? null,
    // 9곳 전부 null인 것이 정상이다. 매장에 가 봐야 아는 값이라 추측으로 채우지 않는다.
    work_policy: (nullable(values.work_policy) as WorkPolicy | null) ?? null,
    status: values.status,
    tags: parseTags(values.tags),
    last_verified: nullable(values.last_verified),
  };
}

/* ─── 사진 ──────────────────────────────────────────────────────────────── */

/**
 * 사진 한 칸. 이미 올라가 있는 것과 방금 고른 것이 **한 배열에 섞여 있다.**
 *
 * 나눠서 들면 순서가 사라진다. `places.photos`의 첫 장이 마커 썸네일이라 순서가
 * 의미를 갖고, "3번을 다른 사진으로 바꾼다"가 3번 자리를 지켜야 한다.
 *
 * 기존 사진이 경로와 URL을 **둘 다** 든다. 저장에 필요한 것은 경로지만 화면에
 * 그릴 것은 URL이고, 그 변환은 서버가 한다 — 그래야 폼이 버킷을 모른다
 * (`lib/place-images.ts`의 규칙).
 */
export type PhotoSlot =
  | { kind: 'existing'; path: string; url: string }
  | { kind: 'new'; file: File; key: string };

/** 검수 폴더의 사진인가. 제보에서 온 사진은 `submissions/<uid>/` 아래에 있다 */
export function isSubmissionPath(path: string): boolean {
  return path.startsWith('submissions/');
}

/**
 * `places.photos`에서 빠진 경로 중 **storage에서도 지울 것**.
 *
 * ⚠️ `submissions/` 아래는 남긴다. 제보 row가 그 URL을 여전히 가리키기 때문이다 —
 * 지우면 검수 이력의 사진 링크가 깨진다. `scripts/prune-orphan-photos.mjs`도 제보
 * row를 참조로 세므로 남겨 둔 파일을 나중에 걷어가지도 않는다. 그 대가로 고아
 * 파일이 남지만, 승인된 사진이 검수 폴더에 그대로 있는 것은 이미 이 저장소의 설계다.
 */
export function deletablePaths(original: string[], remaining: string[]): string[] {
  const kept = new Set(remaining);
  return original.filter((path) => !kept.has(path) && !isSubmissionPath(path));
}

/** 슬롯 배열에서 살아남은 기존 경로만 */
export function remainingPaths(slots: PhotoSlot[]): string[] {
  return slots.flatMap((slot) => (slot.kind === 'existing' ? [slot.path] : []));
}

/** 그 자리의 사진을 새 파일로 바꾼다. **위치가 유지된다** */
export function replaceSlot(slots: PhotoSlot[], index: number, file: File, key: string): PhotoSlot[] {
  return slots.map((slot, at) => (at === index ? { kind: 'new', file, key } : slot));
}

export function removeSlot(slots: PhotoSlot[], index: number): PhotoSlot[] {
  return slots.filter((_, at) => at !== index);
}
