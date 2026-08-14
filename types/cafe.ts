export type OutletLevel = 'many' | 'some' | 'few' | 'none';
export type NoiseLevel = 'quiet' | 'normal' | 'noisy';
export type WorkFit = 'good' | 'ok' | 'bad';

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
  /** 사진 URL 목록. 없는 카페는 빈 배열 — 화면은 빈 상태로 처리한다 */
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
