import type { Metadata } from "next";
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
