import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * ⚠️ **`destructive` variant가 없다.** 원본에는 빨간 배지가 있었지만
 * "`별로`·실패·빈 상태에 경고색을 주지 않는다. 색이 드는 것은 좋은 조건뿐이다"가
 * 이 저장소의 규칙이다. 반려 상태는 `secondary`(무채색)를 쓴다.
 *
 * 좋은 조건에 드는 색은 `positive` 하나이고 값은 Quick Check와 같은 민트다.
 */
const badgeVariants = cva(
  // pill이라 좌우 패딩이 반지름보다 커야 글자가 곡선에 붙지 않는다 (Button과 같은 이유).
  // 높이가 28px이면 반지름 14px이므로 px-4(16px)가 최소선이다.
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-4 py-1 text-meta font-bold whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-surface-container text-on-surface-variant',
        positive: 'bg-pastel-mint text-positive-text',
        outline: 'border-outline-variant text-on-surface-variant',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
