'use client';

/**
 * page.tsx가 던질 때 뜨는 화면. getCafes()가 Supabase에 못 붙으면 여기로 온다.
 *
 * ⚠️ 두 번째 prop은 `reset`이 아니라 `retry`다. Next 16에서 바뀌었고, 기존 예제를
 * 그대로 옮기면 버튼이 아무 일도 하지 않는다. reset은 다시 가져오지 않고 다시 그리기만
 * 하므로 데이터 실패에는 쓸모가 없다
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="fallback">
      <div className="fallback__panel">
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1 className="fallback__title">지도를 불러오지 못했어요</h1>
        <p className="fallback__body">
          잠깐 생긴 문제일 수 있어요. 다시 시도해 보고, 그래도 안 되면 조금 뒤에 열어 주세요.
        </p>
        <button type="button" className="fallback__action" onClick={() => retry()}>
          다시 시도
        </button>
        {/* 서버 컴포넌트 에러는 메시지가 가려지고 digest만 남는다. 로그와 맞춰볼 유일한 끈이다. */}
        {error.digest && <p className="fallback__digest">오류 번호 {error.digest}</p>}
      </div>
    </main>
  );
}
