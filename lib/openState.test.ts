import { describe, expect, it } from 'vitest';
import { formatBusinessHours, isOpenNow } from '@/lib/openState';
import { makeCafe } from '@/test/fixtures';

/**
 * isOpenNow는 getHours()/getMinutes()를 쓰므로 로컬 시각으로 판정한다.
 * Date를 로컬 생성자로 만들면 실행 환경의 타임존과 무관하게 같은 결과가 나온다.
 */
const at = (hour: number, minute = 0) => new Date(2026, 7, 17, hour, minute);

describe('isOpenNow', () => {
  it('24시간 영업이면 시간을 보지 않는다', () => {
    const cafe = makeCafe({ is_24h: true, open_time: '', close_time: '' });
    expect(isOpenNow(cafe, at(4))).toBe(true);
    expect(isOpenNow(cafe, at(15))).toBe(true);
  });

  describe('자정을 넘기지 않는 영업시간 (09:00~22:00)', () => {
    const cafe = makeCafe({ open_time: '09:00', close_time: '22:00' });

    it('구간 안이면 영업중이다', () => {
      expect(isOpenNow(cafe, at(15))).toBe(true);
    });

    it('여는 시각은 포함한다', () => {
      expect(isOpenNow(cafe, at(8, 59))).toBe(false);
      expect(isOpenNow(cafe, at(9, 0))).toBe(true);
    });

    it('닫는 시각은 포함하지 않는다', () => {
      expect(isOpenNow(cafe, at(21, 59))).toBe(true);
      expect(isOpenNow(cafe, at(22, 0))).toBe(false);
    });
  });

  /**
   * 시드에 실제로 있는 나루터가 12:00~00:00이다. 이 분기는 죽은 코드가 아니라
   * 현재 데이터가 매일 지나가는 경로다.
   */
  describe('자정에 닫는 영업시간 (12:00~00:00)', () => {
    const cafe = makeCafe({ open_time: '12:00', close_time: '00:00' });

    it('열기 전에는 영업중이 아니다', () => {
      expect(isOpenNow(cafe, at(11, 59))).toBe(false);
    });

    it('여는 시각부터 자정 직전까지 영업중이다', () => {
      expect(isOpenNow(cafe, at(12, 0))).toBe(true);
      expect(isOpenNow(cafe, at(23, 59))).toBe(true);
    });

    it('자정에 닫힌다', () => {
      expect(isOpenNow(cafe, at(0, 0))).toBe(false);
    });
  });

  describe('자정을 넘겨 영업 (10:00~02:00)', () => {
    const cafe = makeCafe({ open_time: '10:00', close_time: '02:00' });

    it('새벽 구간도 영업중으로 본다', () => {
      expect(isOpenNow(cafe, at(1, 0))).toBe(true);
    });

    it('닫은 뒤 여는 시각 전까지는 영업중이 아니다', () => {
      expect(isOpenNow(cafe, at(2, 0))).toBe(false);
      expect(isOpenNow(cafe, at(9, 59))).toBe(false);
    });
  });

  it('여는 시각과 닫는 시각이 같으면 종일 영업으로 본다', () => {
    // close <= open을 "자정을 넘긴다"로 읽는 규칙의 귀결이다.
    const cafe = makeCafe({ open_time: '09:00', close_time: '09:00' });
    expect(isOpenNow(cafe, at(3))).toBe(true);
    expect(isOpenNow(cafe, at(9))).toBe(true);
    expect(isOpenNow(cafe, at(20))).toBe(true);
  });
});

describe('formatBusinessHours', () => {
  it('24시간 영업은 시각 대신 24시간으로 적는다', () => {
    expect(formatBusinessHours(makeCafe({ is_24h: true }))).toBe('24시간');
  });

  it('그 외에는 여는 시각과 닫는 시각을 잇는다', () => {
    const cafe = makeCafe({ open_time: '09:00', close_time: '22:00' });
    expect(formatBusinessHours(cafe)).toBe('09:00 - 22:00');
  });
});
