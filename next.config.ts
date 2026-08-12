import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 디렉터리의 package-lock.json을 프로젝트 루트로 오인하지 않도록 고정한다.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
