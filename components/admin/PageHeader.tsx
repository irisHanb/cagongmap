import type { ReactNode } from 'react';

/**
 * 관리자 화면의 머리말.
 *
 * eyebrow → 제목 → 한 줄 설명 순서는 공개 화면의 dock·북마크 패널과 같은 idiom이다
 * (`WORK CAFE MAP` / `BOOKMARKS` / `QUICK CHECK`). 관리자 화면이 다른 서비스처럼
 * 보이지 않게 하는 장치가 색 말고 이것 하나 더 있는 셈이다.
 *
 * **가운데 정렬이다.** 목록·폼이 넓은 화면에서 왼쪽에 몰려 보이지 않게 기둥을
 * 가운데로 세운다. 설명 줄은 `max-w-2xl`로 묶는다 — 한 줄이 화면 폭만큼 길어지면
 * 눈이 다음 줄 첫 글자를 찾지 못한다.
 *
 * eyebrow만 영문 대문자에 0.12em 자간을 쓴다. DESIGN.md가 허용한 유일한 자리다 —
 * 한글에 자간을 주면 낱말이 흩어진다.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-6 text-center">
      <div className="space-y-2">
        <p className="text-eyebrow text-on-surface-variant">{eyebrow}</p>
        <h1 className="text-display text-on-surface">{title}</h1>
        {description && (
          <p className="mx-auto max-w-2xl text-body text-on-surface-variant">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
