import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * shadcn 원본을 DESIGN.md 규격으로 고쳤다. 바꾼 것은 셋이다.
 *
 *  1. **pill radius + 48px 높이.** search-bar·kakao-login·제보 폼 버튼이 전부 그렇다.
 *     한국어 UI에서 긴 단어가 버튼 안에서 눌리지 않게 높이와 padding을 먼저 확보한다.
 *  2. **타이포는 `text-label`(14/700).** 크기와 굵기를 따로 적지 않는다.
 *  3. **`destructive`를 지웠다.** 색이 드는 것은 좋은 조건뿐이라는 규칙 때문에 이
 *     저장소에는 경고색이 없다. 반려·삭제는 `secondary`나 `ghost`를 쓴다.
 *     남겨 두면 다음 사람이 "빨간 버튼이 있으니 여기 쓰라는 뜻"으로 읽는다.
 *
 * dark: 클래스도 전부 걷어냈다. 팔레트가 라이트 하나뿐이다.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-label whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 화면당 하나만. "큰 CTA를 여러 개 만들지 않는다" (DESIGN.md) */
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-surface-container text-on-surface hover:bg-surface-high',
        outline:
          'border border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-low',
        ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /**
       * ⚠️ **pill 버튼은 좌우 패딩이 반지름보다 커야 한다.**
       * radius가 높이의 절반이므로 h-12(48px)면 모서리가 24px를 파고든다. 거기에
       * px-6(24px)을 주면 글자가 곡선에 딱 붙어 "왼쪽으로 쏠린" 것처럼 보인다.
       * 한 칸 더 줘서 px-8(32px) — 반지름 + 8px이 눈으로 균형이 잡히는 선이다.
       * 한국어 UI에서 긴 낱말이 눌리지 않게 하려는 목적도 겹친다 (DESIGN.md).
       */
      size: {
        default: 'h-12 px-8',
        sm: 'h-10 gap-1 px-6',
        icon: 'size-12',
        'icon-sm': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
