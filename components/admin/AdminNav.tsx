'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * 관리자 상단 탭. 지금 어디에 있는지만 알려주면 되므로 링크 두 개가 전부다.
 *
 * 클라이언트 컴포넌트인 이유는 `usePathname` 하나 때문이다. 그 하나 때문에 레이아웃
 * 전체를 클라이언트로 내리지 않으려고 이 조각만 갈라 두었다 — 레이아웃이 서버로
 * 남아야 거기서 세션을 읽고 `notFound()`를 부를 수 있다.
 *
 * 모양은 dock의 pill 규격을 따른다. 높이만 40px로 낮췄다 — 상단 바가 64px이라
 * 48px 컨트롤을 넣으면 위아래 여백이 8px씩밖에 남지 않는다.
 */
const TABS = [
  { href: '/admin/reports', label: '제보' },
  { href: '/admin/places', label: '장소' },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        // startsWith라 /admin/places/new에서도 '장소'가 켜져 있다.
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center rounded-full px-6 text-label transition-colors',
              active
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
