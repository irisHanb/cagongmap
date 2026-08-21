import type { Cafe } from '@/types/cafe';
import type { PlaceRow } from '@/lib/cafes';

/**
 * 테스트용 카페 데이터.
 *
 * 테스트마다 Cafe를 통째로 적으면 필드가 하나 늘 때마다 전부 고쳐야 하고, 무엇보다
 * 그 테스트가 어떤 값에 관심 있는지가 묻힌다. 기본값을 여기 두고 각 테스트는
 * 자기가 보는 필드만 덮어쓴다.
 *
 * `import type`으로만 lib/cafes를 참조한다. 값으로 가져오면 lib/supabase가 함께
 * 로드되면서 이 파일이 환경변수에 묶인다.
 */
export function makeCafe(overrides: Partial<Cafe> = {}): Cafe {
  return {
    id: 'naruteo',
    name: '나루터',
    address: '서울 송파구 백제고분로 000',
    lat: 37.5078,
    lng: 127.1072,
    naver_place_url: null,
    open_time: '09:00',
    close_time: '22:00',
    is_24h: false,
    iced_americano_price: 4500,
    outlet: 'many',
    wifi: true,
    noise: 'quiet',
    work_fit: 'good',
    // 시드 9곳이 전부 그렇듯 기본은 null이다. 값을 보는 테스트만 덮어쓴다.
    work_policy: null,
    photos: [],
    tags: [],
    last_verified: '2026-08-15',
    ...overrides,
  };
}

/**
 * places 테이블 한 행. toCafe()에 넣을 입력이다.
 *
 * photos는 **버킷 경로**다(`naruteo.jpeg`). Cafe.photos는 toCafe()가 만든 공개
 * URL이므로 둘의 모양이 다르다 — 그 변환이 lib/cafes.test.ts의 검증 대상이다.
 */
export function makePlaceRow(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    slug: 'naruteo',
    name: '나루터',
    address: '서울 송파구 백제고분로 000',
    lat: 37.5078,
    lng: 127.1072,
    naver_place_url: null,
    open_time: '12:00',
    close_time: '00:00',
    is_24h: false,
    iced_americano_price: 4500,
    outlet: 'many',
    wifi: true,
    noise: 'quiet',
    work_fit: 'good',
    // 시드 9곳이 전부 그렇듯 기본은 null이다. 값을 보는 테스트만 덮어쓴다.
    work_policy: null,
    photos: [],
    tags: [],
    last_verified: '2026-08-15',
    ...overrides,
  };
}
