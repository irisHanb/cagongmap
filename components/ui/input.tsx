import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * DESIGN.md — Submission Form: **높이 48px, pill radius, 흰 배경,
 * `outline-variant` 테두리.** search-bar도 같은 규격이라 이 저장소의 입력은
 * 한 가지 모양만 갖는다.
 *
 * `type="date"`·`type="time"`은 브라우저가 안쪽에 자기 위젯을 그리므로 padding을
 * 조금 덜 준다. 그러지 않으면 달력 아이콘이 pill 밖으로 밀린다.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-full border border-outline-variant bg-surface-lowest px-4 text-body text-on-surface transition-colors outline-none',
        'selection:bg-primary selection:text-primary-foreground placeholder:text-outline',
        'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20',
        'disabled:pointer-events-none disabled:opacity-50',
        // 읽기 전용은 disabled와 다르게 그린다. 값은 살아 있고 복사할 수 있어야 하므로
        // 흐리게 만들지 않고, 배경을 한 단계 눌러 "여기는 쓰는 칸이 아니다"만 말한다.
        'read-only:cursor-default read-only:bg-surface-low read-only:text-on-surface-variant',
        'read-only:focus-visible:border-outline-variant read-only:focus-visible:ring-0',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
