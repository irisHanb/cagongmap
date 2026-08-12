import type { Cafe } from '@/types/cafe';

/** "HH:mm" → 자정 기준 분 */
function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * 지금 영업 중인지 판정한다.
 *
 * close_time이 open_time보다 작거나 같으면 자정을 넘겨 영업하는 것으로 본다.
 * 예: 12:00~00:00, 10:00~02:00 → 이 경우 구간이 둘로 갈라지므로 OR로 판정한다.
 *
 * @param now 판정 기준 시각. 테스트를 위해 주입 가능하게 열어둔다.
 */
export function isOpenNow(cafe: Cafe, now: Date = new Date()): boolean {
  if (cafe.is_24h) return true;

  const current = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(cafe.open_time);
  const close = toMinutes(cafe.close_time);

  // 자정을 넘기지 않는 일반 영업시간 (예: 08:00~22:00)
  if (open < close) {
    return current >= open && current < close;
  }

  // 자정을 넘기는 영업시간 (예: 12:00~00:00, 10:00~02:00)
  return current >= open || current < close;
}

export function formatBusinessHours(cafe: Cafe): string {
  if (cafe.is_24h) return '24시간';
  return `${cafe.open_time} - ${cafe.close_time}`;
}
