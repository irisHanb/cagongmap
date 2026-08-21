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
  /**
   * 보안 헤더. Vercel이 HSTS는 직접 붙여 주지만 나머지는 아무도 붙여 주지 않는다.
   *
   * 로그인·리뷰·제보를 받는 이상 없을 이유가 없어서 넣는다. CSP는 여기 없다 —
   * 카카오 SDK·Supabase·next/image가 얽혀 있어 제대로 쓰려면 별도 작업이고,
   * 어설픈 CSP는 지도를 통째로 깨뜨린다.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 선언한 MIME 타입을 브라우저가 추측으로 뒤집지 못하게 한다.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 외부로 나갈 때 경로를 흘리지 않는다. 같은 출처에서는 전체 URL을 유지한다.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 이 사이트를 iframe에 넣을 이유가 없다. 로그인 화면이 있는 이상 clickjacking을 막는다.
          { key: 'X-Frame-Options', value: 'DENY' },
          /**
           * 셋 다 쓰지 않으므로 잠근다. 제보 폼의 사진 선택은 OS 파일 선택기라
           * getUserMedia를 타지 않아 camera를 잠가도 영향이 없다.
           * '내 위치' 기능을 넣게 되면 geolocation을 self로 연다.
           */
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
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
