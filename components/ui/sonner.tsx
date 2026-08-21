'use client';

import { CircleCheckIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * 토스트. shadcn 원본에서 두 가지를 걷어냈다.
 *
 *  1. **`next-themes`.** 이 저장소의 팔레트는 라이트 하나뿐이라 테마를 물어볼 곳이
 *     없다. `theme="light"`로 못 박는다.
 *  2. **경고·에러 아이콘.** 원본은 `TriangleAlertIcon`·`OctagonXIcon`을 쓰는데,
 *     "부정 상태에는 색을 주지 않는다. 색이 드는 것은 좋은 조건뿐이다"가 이 저장소의
 *     규칙이다(DESIGN.md). 실패도 정보와 같은 무채색 `info` 아이콘으로 눕히고,
 *     무게는 색이 아니라 문구로 준다. 성공만 민트가 든다.
 *
 * 모양은 Modal 공통 규격에서 가져왔다 — `surface` 배경, `{rounded.lg}`,
 * `{shadows.brew}`. 지도 위 dock·모달과 같은 언어를 쓰게 하려는 것이다.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      // 관리자 화면은 데스크톱 전용이라 오래 띄울 이유가 없다. 실패 문구는 폼 안에도
      // 남으므로 여기서 놓쳐도 잃는 정보가 없다.
      duration={4000}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <InfoIcon className="size-4" />,
        error: <InfoIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-outline-variant bg-surface text-on-surface shadow-brew',
          title: 'text-label',
          description: 'text-meta text-on-surface-variant',
          // 좋은 결과에만 드는 색. Quick Check·승인 배지와 같은 민트다.
          success: 'bg-pastel-mint text-positive-text border-transparent',
          actionButton: 'text-label',
        },
      }}
      {...props}
    />
  );
}
