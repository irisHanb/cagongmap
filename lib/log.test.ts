import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';

function captured(fn: () => void): Record<string, unknown>[] {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  fn();
  const lines = [...spy.mock.calls, ...warn.mock.calls, ...error.mock.calls];
  return lines.map(([line]) => JSON.parse(line as string));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LOG_LEVEL;
});

describe('log', () => {
  it('레벨보다 낮은 로그를 버린다', () => {
    process.env.LOG_LEVEL = 'info';
    expect(captured(() => log('debug', 'x'))).toHaveLength(0);
    expect(captured(() => log('info', 'x'))).toHaveLength(1);
  });

  it('민감한 키를 빼고 나머지는 그대로 남긴다', () => {
    const [line] = captured(() =>
      log('info', 'auth.login', {
        user_id: 'uuid-1',
        code: '23505',
        access_token: 'secret',
        email: 'a@b.com',
      }),
    );

    expect(line.user_id).toBe('uuid-1');
    // Postgres 오류 코드는 남아야 한다. 이게 로그에서 가장 쓸모 있는 값이다
    expect(line.code).toBe('23505');
    expect(line.access_token).toBeUndefined();
    expect(line.email).toBeUndefined();
  });

  it('시간·레벨·이벤트를 항상 담는다', () => {
    const [line] = captured(() => log('error', 'admin.place.save', { outcome: 'error' }));
    expect(line.level).toBe('error');
    expect(line.event).toBe('admin.place.save');
    expect(typeof line.ts).toBe('string');
  });
});
