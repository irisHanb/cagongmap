import type { Metadata } from "next";
// Pretendard variable + dynamic subset. 유니코드 구간별로 92조각이라 브라우저가
// 실제로 쓰는 글자 구간만 내려받는다. 정적 웨이트 파일(각 770KB)을 셋 얹는 것보다 가볍다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "카공맵 — 노트북 작업하기 좋은 카페 지도",
  description: "콘센트·와이파이·소음으로 작업하기 좋은 카페를 지도에서 찾습니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
