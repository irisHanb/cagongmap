import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * 입력과 같은 규격이되 **모서리만 `rounded.md`**다. DESIGN.md — Submission Form:
 * "입력: 높이 48px, pill radius … 메모는 `{rounded.md}`". 여러 줄이 들어가는 칸을
 * pill로 두면 첫 줄과 마지막 줄이 모서리에 잘린다.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-outline-variant bg-surface-lowest px-4 py-2 text-body text-on-surface transition-colors outline-none',
        'placeholder:text-outline',
        'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
