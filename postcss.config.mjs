/**
 * Tailwind v4는 PostCSS 플러그인 하나로 끝난다. tailwind.config.js가 없다 —
 * 설정(테마 토큰·스캔 범위)은 CSS 안의 `@theme`·`@source`로 들어간다.
 *
 * ⚠️ 이 파일이 생겼다고 해서 Tailwind가 공개 화면에 적용되는 것은 아니다.
 * `@import "tailwindcss"`를 하는 CSS는 app/admin/admin.css 하나뿐이고, 그 파일은
 * app/admin/layout.tsx만 import한다. Next가 CSS를 라우트 세그먼트 단위로 묶으므로
 * preflight(전역 리셋)는 /admin 밖으로 나가지 않는다.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
