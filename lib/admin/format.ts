/**
 * 관리자 화면의 날짜 표기.
 *
 * ⚠️ **timeZone을 반드시 고정한다.** 서버와 브라우저가 각자의 기본 시간대로 찍으면
 * 서버 렌더 결과와 하이드레이션 결과가 달라져 React가 경고를 낸다(서버는 대개 UTC,
 * 브라우저는 KST라 9시간 차이가 그대로 화면에 드러난다). 이 서비스는 송파·잠실이
 * 권역이라 표기 기준은 서울 하나면 된다.
 */
const SEOUL = 'Asia/Seoul';

const DATE_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ISO 문자열 → `2026. 08. 21. 14:32` */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return DATE_TIME.format(at);
}

/** 표에 넣을 만큼만 자른다. 메모 전문은 dialog에서 본다 */
export function truncate(value: string | null, max = 28): string {
  if (!value) return '—';
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** URL에서 호스트만. 표에 전체 URL을 늘어놓으면 다른 컬럼이 다 밀린다 */
export function hostOf(url: string | null): string {
  if (!url) return '—';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
