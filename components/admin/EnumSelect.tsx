'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

/**
 * nullable enum 하나를 고르는 칸.
 *
 * ⚠️ **Radix Select는 빈 문자열을 값으로 쓰지 못한다.** 빈 값을 "선택 해제"로 쓰기
 * 때문이다. 그런데 이 저장소의 enum 컬럼은 전부 nullable이고 "모름"이 정상 상태다
 * (`work_policy`는 9곳 전부 null이다). 그래서 화면에서는 센티널(`__none`)로 다루고
 * 폼 값으로 나갈 때만 빈 문자열로 되돌린다. 그 변환을 이 파일 하나에 가둔다.
 */
const NONE = '__none';

export default function EnumSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  emptyLabel = '모름',
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  disabled?: boolean;
  /** 값이 없을 때의 문구. 필수 칸이면 이 항목 자체가 나오지 않는다 */
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value === '' ? NONE : value}
        onValueChange={(next) => onChange(next === NONE ? '' : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
