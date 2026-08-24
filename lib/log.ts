import { cache } from 'react';

/**
 * ★ 구조화 로그 (한 곳)
 *
 * 의존성을 더하지 않는다. Vercel도 `node`도 stdout/stderr 한 줄을 그대로 걷어가므로
 * JSON 한 줄이면 수집기가 파싱한다. pino·winston을 넣을 이유가 없다.
 *
 * ⚠️ **관측이 필요한 로그는 서버에서 남긴다.** 이 함수는 브라우저에서도 돌지만,
 * 그때는 사용자 콘솔에 찍힐 뿐 수집기에 가지 않는다. 규칙은 CLAUDE.md 「로깅」 참고.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * 운영에서 debug를 뺀다. `LOG_LEVEL`로 덮을 수 있다 — 운영에서 잠깐 열어 볼 때 쓴다.
 * 값이 이상하면 조용히 info로 떨어진다. 로그 설정 하나 때문에 앱이 뜨지 않으면 안 된다.
 */
function minRank(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in RANK) return RANK[configured];
  return process.env.NODE_ENV === 'production' ? RANK.info : RANK.debug;
}

/**
 * 값을 지우는 키.
 *
 * 규칙을 사람의 기억에 맡기지 않는다 — 한 번 새면 수집기에 남아 되돌릴 수 없다.
 * `code`는 일부러 넣지 않았다. Postgres 오류 코드(`23505`)가 그 이름으로 오고,
 * 그것이 로그에서 가장 쓸모 있는 값이다. OAuth `code`는 애초에 넘기지 않는다.
 */
const SECRET_KEY = /token|secret|password|passwd|api_?key|email|phone/i;

export interface LogFields {
  /** 한 요청 안의 로그를 잇는 값. `requestId()`로 얻는다 */
  request_id?: string;
  /** uuid만. 이메일·닉네임을 넣지 않는다 */
  user_id?: string;
  outcome?: 'ok' | 'error' | 'denied';
  duration_ms?: number;
  [key: string]: unknown;
}

/**
 * `event`는 `도메인.동작` 꼴로 고정한다(`admin.place.save`). 문장을 넣으면 문구를
 * 다듬을 때마다 대시보드의 집계가 끊긴다.
 */
export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (RANK[level] < minRank()) return;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY.test(key)) continue;
    if (value !== undefined) safe[key] = value;
  }

  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * 이 요청의 추적값.
 *
 * React의 `cache`가 요청 단위라, 같은 요청 안에서 몇 번을 불러도 같은 값이 나온다
 * (`lib/admin/guard.ts`의 `getCurator`와 같은 방법이다).
 *
 * `headers()`를 읽지 않는 것이 중요하다 — 읽는 순간 `app/page.tsx`의
 * `revalidate = 300`이 죽고 요청마다 동적 렌더가 된다. 플랫폼의 요청 id와 잇지
 * 못하는 대신 캐시를 지킨다.
 */
export const requestId = cache((): string => crypto.randomUUID());

/** 실패 원인 한 줄. 로그와 사용자 문구가 같은 문자열을 쓰게 한다 */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
