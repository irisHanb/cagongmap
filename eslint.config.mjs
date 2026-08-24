import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 검증 도구가 만드는 산출물. 소스가 아니다.
    "coverage/**",
    ".playwright/**",
    ".playwright-cli/**",
    // 로컬 worktree. 그 안의 .next는 위 ".next/**"가 최상위만 잡아서 걸리지 않는다.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
