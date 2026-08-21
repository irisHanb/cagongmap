import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui가 모든 컴포넌트에서 쓰는 클래스 병합 헬퍼.
 *
 * **관리자 화면 전용이다.** 공개 화면은 Tailwind를 쓰지 않으므로 여기 닿을 일이 없다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
