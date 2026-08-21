'use client';

/**
 * 루트 레이아웃 자체가 터졌을 때만 뜬다. 이 화면은 layout.tsx를 **대체**하므로
 * globals.css도 Pretendard도 닿지 않는다 — 그래서 인라인 스타일이고, 토큰 값도
 * var()가 아니라 리터럴이다. 여기서 CSS를 import하면 그 CSS가 못 뜨는 상황에서
 * 화면이 통째로 사라진다.
 *
 * metadata를 export할 수 없어(클라이언트 컴포넌트) 제목은 React의 <title>로 단다.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#fffaf8',
          color: '#211b1a',
          fontFamily:
            "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', sans-serif",
        }}
      >
        <title>문제가 생겼어요 · 카공맵</title>
        <div style={{ maxWidth: 390, textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#88484a',
            }}
          >
            WORK CAFE MAP
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, lineHeight: '36px' }}>
            문제가 생겼어요
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: '24px', color: '#5b504d' }}>
            잠깐 생긴 문제일 수 있어요. 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 24,
              height: 40,
              padding: '0 24px',
              border: '1px solid #e2d5d1',
              borderRadius: 9999,
              background: '#ffffff',
              color: '#5b504d',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          {error.digest && (
            <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: '16px', color: '#92817d' }}>
              오류 번호 {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
