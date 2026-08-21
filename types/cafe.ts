export type OutletLevel = 'many' | 'some' | 'few' | 'none';
export type NoiseLevel = 'quiet' | 'normal' | 'noisy';
export type WorkFit = 'good' | 'ok' | 'bad';
/**
 * 카공 허용 정책. work_fit과 다른 정보다 — 저쪽은 환경 품질이고 이쪽은 매장 정책이다.
 * "작업하기 좋은 자리"와 "눈치 안 보고 있어도 되는가"는 같이 가지 않는다.
 */
export type WorkPolicy = 'welcome' | 'allowed' | 'frowned' | 'banned';

export interface Cafe {
  /** 마커 · 리스트 · 상세를 잇는 키. 이름은 바뀌므로 키로 쓰지 않는다. */
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** DB에서 nullable — 아직 링크를 못 찾은 카페가 있을 수 있다 */
  naver_place_url: string | null;
  /** "HH:mm" */
  open_time: string;
  /** "HH:mm" — "00:00"은 자정 마감 */
  close_time: string;
  is_24h: boolean;
  /** DB에서 nullable — 가격을 확인하지 못한 카페는 null */
  iced_americano_price: number | null;
  outlet: OutletLevel;
  wifi: boolean;
  noise: NoiseLevel;
  work_fit: WorkFit;
  /**
   * DB에서 nullable이고 지금은 9곳 전부 null이다. 매장에 가 봐야 아는 값이라
   * 추측으로 채우지 않는다 — 값이 있는 카페에만 화면에 나온다 (DESIGN.md Quick Check).
   */
  work_policy: WorkPolicy | null;
  /**
   * 바로 렌더할 수 있는 사진 URL 목록. 없는 카페는 빈 배열 — 화면은 빈 상태로 처리한다.
   *
   * DB에는 place-images 버킷의 경로로 담겨 있고, toCafe()가 공개 URL로 바꿔 준다
   * (lib/place-images.ts). 외부 CDN 이미지는 여기에 오지 않는다.
   */
  photos: string[];
  tags: string[];
  /** "YYYY-MM-DD" — 신선도 표시용 */
  last_verified: string;
}

export const OUTLET_LABEL: Record<OutletLevel, string> = {
  many: '콘센트 많음',
  some: '콘센트 보통',
  few: '콘센트 적음',
  none: '콘센트 없음',
};

export const NOISE_LABEL: Record<NoiseLevel, string> = {
  quiet: '조용함',
  normal: '보통',
  noisy: '시끄러움',
};

export const WORK_FIT_LABEL: Record<WorkFit, string> = {
  good: '작업 적합',
  ok: '무난함',
  bad: '작업 비적합',
};

/** 매장이 카공을 어떻게 대하는지. 값이 있는 카페에만 쓴다. */
export const WORK_POLICY_LABEL: Record<WorkPolicy, string> = {
  welcome: '카공 환영',
  allowed: '카공 허용',
  frowned: '눈치 보임',
  banned: '카공 금지',
};
