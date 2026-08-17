import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 테스트마다 DOM을 비운다. 남겨 두면 getByText가 이전 테스트의 노드를 함께 잡아
// "여러 개가 매칭됐다"로 엉뚱하게 실패한다.
afterEach(cleanup);
