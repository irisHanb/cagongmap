# Checklist: dock 카페 목록 검색

## Tasks

- [ ] T1 `lib/cafe-search.ts`에 `filterCafes(cafes, query)`를 쓴다 — 정규화(trim·소문자)와 이름·주소 부분 일치가 이 파일에만 있다 (req: R2, R7)
- [ ] T2 `lib/cafe-search.test.ts`에 이름 일치·주소 일치·대소문자·앞뒤 공백·빈 검색어·무결과 케이스를 쓴다 (req: R2) (ac: AC2, AC3) (after: T1)
- [ ] T3 `CafeListPanel`에 `query`·`onQueryChange` props와 `ui/input` 입력칸을 제목 아래·목록 위에 넣는다 (req: R1, R8, R9) (ac: AC1, AC8)
- [ ] T4 `CafeListPanel`에 결과 0곳 빈 상태 한 줄을 넣는다 (req: R4) (ac: AC5) (after: T3)
- [ ] T5 `MapShell`에 `query` state를 두고 `filterCafes` 결과를 `CafeListPanel`·`CafeMarkers`에 넘긴다. 상단 `카페 N곳`은 원본 수로 남긴다 (req: R3, R5, R6, R10) (ac: AC4, AC6, AC7) (after: T1, T3)
- [ ] T6 `app/globals.css`에 `.cafe-list-panel__search`·`.cafe-list-panel__empty`를 더한다 — 빈 상태는 `.bookmark-panel__empty`와 같은 규격 (req: R9) (after: T3, T4)
- [ ] T7 `CafeListPanel.test.tsx`에 입력칸 렌더·입력 전달·빈 상태 테스트를 더한다 (ac: AC1, AC5, AC8) (after: T4)
- [ ] T8 `npm run verify`를 돌린다 (ac: AC9) (after: T2, T5, T6, T7)
- [ ] T9 개발 서버(포트 3030)를 띄우고 브라우저에서 마커 필터·개수·초기화·콘솔을 확인한다 (ac: AC4, AC6, AC7) (after: T8)
- [ ] T10 `DESIGN.md`(Left Panel 4번·8번, Search Bar, Interaction Rules)·`docs/scope.md` 변경 이력·`MapView.tsx` 주석을 갱신한다 (req: R11) (ac: AC10) (after: T5)

## Acceptance Criteria

- [ ] AC1 제목과 목록 사이에 `동네나 카페 이름` placeholder 입력칸이 보인다
- [ ] AC2 `나루터`는 그 카페만, `송파`는 주소에 송파가 든 카페만 남긴다
- [ ] AC3 `NARUTEO` / ` 나루터 `가 `나루터`와 같은 결과를 낸다
- [ ] AC4 검색 중 지도에 남은 마커 수 = 목록 카드 수
- [ ] AC5 `zzzz`를 넣으면 카드 0장 + 빈 상태 한 줄
- [ ] AC6 제목 옆 개수는 걸러진 수, dock 상단 `카페 9곳`은 9 그대로
- [ ] AC7 입력칸을 비우면 카드 9장·마커 9개가 돌아온다
- [ ] AC8 `getByRole('searchbox', { name: '카페 검색' })`로 입력칸을 잡을 수 있다
- [ ] AC9 `npm run verify` 통과 (lint --max-warnings=0 · typecheck · test)
- [ ] AC10 `DESIGN.md`의 "4번 검색바만 남았다"가 갱신되고 `docs/scope.md`에 2026-08-26 항목이 있다

## Human Checks

- [ ] 검색 중 지도 마커가 실제로 사라진다 (스냅샷은 카카오맵 오버레이를 읽지 못한다)
- [ ] 입력칸이 목록 스크롤과 함께 밀려 올라가지 않는다
- [ ] 목록이 짧아져도 dock 높이가 튀지 않는다
- [ ] 559px 미만 화면에서 입력칸이 dock 폭을 넘지 않는다
- [ ] 0곳 문구의 말투가 다른 빈 상태 문구와 어긋나지 않는다
