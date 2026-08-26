import type { Cafe } from '@/types/cafe';

/**
 * dock 목록·지도 마커가 함께 쓰는 필터 판정. 이름 또는 주소에 검색어가 부분
 * 일치하면 남긴다 (DESIGN.md Interaction Rules — "검색어는 마커 표시 범위를 줄인다").
 *
 * 대소문자와 앞뒤 공백은 무시한다. 검색어가 비어 있으면 전부 돌려준다.
 */
export function filterCafes(cafes: Cafe[], query: string): Cafe[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cafes;

  return cafes.filter(
    (cafe) =>
      cafe.name.toLowerCase().includes(normalized) ||
      cafe.address.toLowerCase().includes(normalized),
  );
}
