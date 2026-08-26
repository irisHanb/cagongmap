---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - vitest.config.mts
  - vitest.setup.ts
  - test/**
  - supabase/tests/**
---

# 테스트

## Vitest

- 테스트 파일은 대상 옆에 둔다 — `lib/openState.ts` ↔ `lib/openState.test.ts`.
- **`Cafe`·`PlaceRow` 더미는 `test/fixtures.ts`의 `makeCafe()` / `makePlaceRow()`를 쓴다.**
  객체를 통째로 새로 적으면 필드가 하나 늘 때마다 모든 테스트를 고쳐야 하고, 그
  테스트가 어떤 값에 관심 있는지가 묻힌다. 관심 있는 필드만 덮어쓴다.
- **`globals: false`다.** `describe`/`it`/`expect`를 `vitest`에서 명시적으로 import한다.
- **`lib/supabase-env.ts`가 import 시점에 throw하는 것을 앱 코드로 풀지 않는다.**
  폴백을 두지 않는 것이 의도된 설계이므로, 더미 값은 `vitest.config.mts`의 `test.env`에
  있다.
- 세션이 필요한 컴포넌트는 **`@/lib/supabase-browser` 하나만 `vi.mock`한다.**
  AuthProvider·BookmarkProvider는 실제 코드가 돌게 둔다 (`components/cafe/CafeCard.test.tsx` 참고).
- **버그를 잡는 테스트는 수정을 되돌려 실패하는지 확인하고 넣는다.** 통과만 보고 넣으면
  무른 테스트가 남는다.
- **가짜 서버 목은 응답을 호출 시점 스냅샷으로 만든다.** 지연 뒤에 현재 상태를 읽어
  돌려주면 "늦게 도착한 옛 응답"이 재현되지 않아 경합 테스트가 통과해 버린다
  (`components/review/ReviewSection.test.tsx` 참고).
- **실제 Supabase에 붙는 테스트를 만들지 않는다.** DB 쪽 검증은
  `./scripts/verify-schema.sh`가 컨테이너에서 따로 한다.

## `supabase/tests/`

- ⚠️ **`select count(*)`를 출력만 하고 두지 않는다.** psql은 값이 무엇이 나오든 exit 0이라
  그런 검사는 RLS를 통째로 지워도 통과한다. 2026-08-23까지 `20_rls_checks.sql`의 절반이
  그 상태였다. **`pg_temp.assert_eq()`로 기대값을 적는다.**
- **막는 것만 적지 않는다.** 거부를 확인하는 케이스 옆에 "규칙을 지킨 입력은 그대로
  들어간다"를 함께 둔다. 없으면 전부 거부하는 정책을 넣어도 그 절이 통과한다.

## 테스트 통과가 화면을 보장하지 않는다

`npm run verify`가 통과해도 UI가 도는지는 별개다. UI를 건드렸으면 루트 CLAUDE.md의
「검증」 절을 따라 실제로 띄워서 확인한다.
