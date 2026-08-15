/**
 * Quick Check fact card 아이콘.
 *
 * 아이콘 라이브러리를 새로 들이지 않고 최소 선으로 직접 그린다. 16x16 뷰박스에
 * currentColor stroke만 쓰므로, 색은 .fact__icon이 정한다(긍정이면 positive-text).
 */
const props = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function OutletIcon() {
  return (
    <svg {...props}>
      <path d="M6 2v3M10 2v3" />
      <path d="M3.5 5h9v3a4.5 4.5 0 0 1-9 0z" />
      <path d="M8 12.5V14" />
    </svg>
  );
}

export function NoiseIcon() {
  return (
    <svg {...props}>
      <path d="M2.5 7v2M5.5 4.5v7M8.5 2.5v11M11.5 5.5v5M14 7.5v1" />
    </svg>
  );
}

export function WifiIcon() {
  return (
    <svg {...props}>
      <path d="M2 6.2a9 9 0 0 1 12 0" />
      <path d="M4.4 8.9a5.5 5.5 0 0 1 7.2 0" />
      <path d="M6.8 11.6a2 2 0 0 1 2.4 0" />
      <path d="M8 13.8h.01" />
    </svg>
  );
}

export function PriceIcon() {
  return (
    <svg {...props}>
      <path d="M3 4h9v4.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M12 5.5h1.5a1.5 1.5 0 0 1 0 3H12" />
      <path d="M3 13.5h9" />
    </svg>
  );
}

export function HoursIcon() {
  return (
    <svg {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.6" />
    </svg>
  );
}
