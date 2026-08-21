import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Next 기본 404는 영어 한 줄이고, prefers-color-scheme을 따라가 다크 모드 기기에서
 * 검은 화면이 된다. 이 저장소는 라이트 팔레트 하나뿐이라(DESIGN.md) 그대로 두면
 * lang="ko" 문서 안에 낯선 영어 화면이 뜬다.
 */
export const metadata: Metadata = {
  title: '없는 페이지',
};

export default function NotFound() {
  return (
    <main className="fallback">
      <div className="fallback__panel">
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1 className="fallback__title">없는 페이지예요</h1>
        <p className="fallback__body">
          주소가 바뀌었거나 지워졌습니다. 지도로 돌아가면 카페는 그대로 있어요.
        </p>
        <Link className="fallback__action" href="/">
          지도로 돌아가기
        </Link>
      </div>
    </main>
  );
}
