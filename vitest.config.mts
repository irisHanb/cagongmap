import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * 테스트 러너 설정.
 *
 * Vitest를 쓰는 이유는 이 저장소가 이미 ESM + TS이고, tsconfig의 `@/*` alias를
 * Vite가 그대로 읽어 주기 때문이다(resolve.tsconfigPaths). 별도 moduleNameMapper를
 * 손으로 유지할 필요가 없다.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // tsconfig.json의 paths(`@/*` → `./*`)를 그대로 쓴다.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // globals를 켜지 않는다. describe/it/expect는 파일마다 vitest에서 명시적으로
    // import한다 — tsconfig의 전역 타입을 테스트 러너가 넓히지 않게 하려는 것이다.
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', '.playwright/**', '.playwright-cli/**'],
    /**
     * lib/supabase-env.ts는 import 시점에 환경변수를 검사하고 없으면 throw한다.
     * 폴백을 두지 않는 것이 의도된 설계라(CLAUDE.md — 환경변수) 앱 코드를 고치는
     * 대신 테스트 환경에만 더미 값을 준다. 실제로 네트워크를 타는 테스트는 없다.
     */
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
