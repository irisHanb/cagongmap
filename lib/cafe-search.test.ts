import { describe, expect, it } from 'vitest';
import { filterCafes } from '@/lib/cafe-search';
import { makeCafe } from '@/test/fixtures';

describe('filterCafes', () => {
  const naruteo = makeCafe({ id: 'naruteo', name: '나루터', address: '서울 송파구 백제고분로 000' });
  const gangnam = makeCafe({ id: 'gangnam', name: 'Gangnam Coffee', address: '서울 강남구 테헤란로 000' });
  const cafes = [naruteo, gangnam];

  it('이름에 부분 일치하면 남긴다', () => {
    expect(filterCafes(cafes, '나루터')).toEqual([naruteo]);
  });

  it('주소에 부분 일치하면 남긴다', () => {
    expect(filterCafes(cafes, '송파')).toEqual([naruteo]);
  });

  it('대소문자를 무시한다', () => {
    expect(filterCafes(cafes, 'GANGNAM')).toEqual([gangnam]);
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(filterCafes(cafes, ' 나루터 ')).toEqual([naruteo]);
  });

  it('빈 검색어는 전부 돌려준다', () => {
    expect(filterCafes(cafes, '')).toEqual(cafes);
    expect(filterCafes(cafes, '   ')).toEqual(cafes);
  });

  it('아무 카페와도 맞지 않으면 빈 배열을 돌려준다', () => {
    expect(filterCafes(cafes, 'zzzz')).toEqual([]);
  });
});
