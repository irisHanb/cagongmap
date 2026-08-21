import type { Metadata } from "next";
// Pretendard variable + dynamic subset. 유니코드 구간별로 92조각이라 브라우저가
// 실제로 쓰는 글자 구간만 내려받는다. 정적 웨이트 파일(각 770KB)을 셋 얹는 것보다 가볍다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

/**
 * og:image / twitter:image는 여기 없다. app/opengraph-image.tsx가 파일 컨벤션이라
 * Next가 절대 URL로 바꿔 태그를 붙인다. 두 군데 적으면 반드시 어긋난다.
 */
export const metadata: Metadata = {
  // 상대 경로를 절대 URL로 바꾸는 기준점. 없으면 Next 16은 빌드를 실패시키고,
  // 있어도 값이 틀리면 카카오톡이 og:image를 못 가져간다.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // 하위 페이지가 생기면 제목이 브랜드를 잃지 않게. 지금은 쓰는 곳이 없다.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // ⚠️ 색인은 막아 둔다. 지금 지도에 걸린 사진 9장은 연습용 임시본이고 이용 권리를
  // 확인하지 않았다(docs/mvp-decisions.md 3절). 사진을 교체하면 이 줄을 지운다.
  //
  // robots.txt가 아니라 meta로 막는 이유는 app/robots.ts에 적어 두었다 — robots.txt로
  // 막으면 슬랙이 링크를 아예 펼치지 않는다.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
