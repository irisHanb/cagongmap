import type { NextConfig } from "next";

/**
 * Supabase Storage 호스트를 next/image에 열어준다.
 *
 * 호스트를 하드코딩하지 않고 NEXT_PUBLIC_SUPABASE_URL에서 뽑는다 — 프로젝트를 옮기면
 * .env.local만 바꾸면 되게. Next가 next.config를 읽기 전에 .env 파일을 먼저 로드한다.
 *
 * 원본 파일이 최대 4MB대라(terarosa_posco.JPG) 최적화 없이 쓰면 마커 썸네일 하나에
 * 몇 MB를 내려받는다. 이 설정이 있어야 next/image가 리사이즈해 준다.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // 상위 디렉터리의 package-lock.json을 프로젝트 루트로 오인하지 않도록 고정한다.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            // 공개 버킷 경로만. 서명 URL이나 다른 엔드포인트까지 열지 않는다.
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
