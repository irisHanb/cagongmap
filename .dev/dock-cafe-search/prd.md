# PRD: dock 카페 목록 검색

## Summary

dock 하단 「카페 전체 목록」 패널 안, 목록 바로 위에 검색 입력칸을 넣는다. 입력한
검색어는 목록과 지도 마커를 **함께** 거른다. 필터 판정은 `lib/cafe-search.ts` 한
곳에 두고, `MapShell`이 거른 배열을 `CafeListPanel`과 `CafeMarkers` 양쪽에 넘긴다.

`DESIGN.md` Left Panel 4번(브랜드 블록과 로그인 사이)에 잡아 둔 검색바 자리를
8번 상자 안으로 옮기는 결정이 여기에 포함된다. 사용자가 2026-08-26에 그렇게 정했다.

## Problem And Goal

**문제.** 지도에는 지금 화면에 든 마커만 보인다. 2026-08-26에 dock 하단 전체 목록을
붙여 "나머지 카페가 어디 있는지 모른다"는 문제는 풀렸지만, 목록은 전부를 나열하기만
한다. 카페가 늘어나면 목록을 스크롤해서 찾는 수밖에 없고, "송파"나 "나루터"를 아는
사용자도 지도를 옮기거나 목록을 훑어야 한다.

**목표.** 이름이나 동네를 입력하면 목록과 지도가 같이 줄어든다. 검색어를 지우면 전부
돌아온다. 필터·정렬은 여전히 만들지 않는다.

## Users And Use Cases

지도를 처음 여는 방문자다. 로그인 여부와 무관하게 쓴다.

| 상황 | 지금 | 이 변경 뒤 |
|---|---|---|
| 상호명을 안다 ("나루터") | 목록을 훑거나 지도를 옮긴다 | 이름을 치면 그 카페만 남는다 |
| 동네를 안다 ("송파", "잠실") | 지도를 그 방향으로 끈다 | 동네를 치면 그 권역만 남는다 |
| 없는 카페를 찾는다 | — | 0곳이라는 사실을 문구로 읽는다 |

## Pre-Work

구현 전에 읽는다.

- `docs/code-guide.md` — 이 저장소의 코드 작성 기준.
- `DESIGN.md` 376-436행 (Left Panel · 카페 전체 목록), 500행 (Search Bar),
  736-738행 (Interaction Rules — "검색어는 마커 표시 범위를 줄인다").
- `components/cafe/CafeListPanel.tsx`, `components/map/MapView.tsx` 머리 주석.
- `.claude/rules/tests.md`, `.claude/rules/ui.md`.

## Non-Goals

만들지 않는다. 요청에 없고, `docs/scope.md`가 2차로 둔 것이다.

- **필터와 정렬.** 콘센트·소음·영업중·가격 조건 UI는 그대로 2차다.
- **한글 초성 검색** (`ㄴㄹㅌ` → 나루터). 카페가 9곳이라 값이 없다.
- **검색어 URL 동기화** (`/?q=송파`). 공유 링크 요구가 나온 적이 없다.
- **`potentialAction.SearchAction` JSON-LD.** URL로 검색 결과에 도달할 수 없으므로
  적어도 거짓이 된다 (`docs/seo-audit-2026-08-21/seo-schema.md` 121행 판단 그대로).
- **디바운스.** 입력마다 9개짜리 배열을 거르는 비용이다.
- **커스텀 지우기(X) 버튼.** `type="search"`가 브라우저 기본 지우기를 준다.
- **`/cafes` 페이지 검색.** 저쪽은 크롤러가 읽는 서버 렌더 문서다 (`DESIGN.md` 485행).
- **태그(`tags`) 검색.** 이름·주소만 본다. placeholder가 약속하는 범위가 그것이다.

## Requirements

- **R1** 「카페 전체 목록」 패널 안, 제목 아래이자 목록(`ul`) 바로 위에 검색 입력칸이
  있다. placeholder는 `동네나 카페 이름`이다.
- **R2** 검색어가 카페의 **이름 또는 주소**에 부분 일치하면 남고, 아니면 빠진다.
  대소문자와 앞뒤 공백은 무시한다.
- **R3** 같은 검색어가 **지도 마커에도** 적용된다. 목록에서 빠진 카페는 지도에서도
  마커가 사라진다.
- **R4** 검색 결과가 0곳이면 목록 자리에 한 줄 문구가 뜬다. 빈 상자를 그대로 두지
  않는다 (`DESIGN.md` — 빈 상태를 숨기지 않는다).
- **R5** 목록 제목 옆 개수는 **걸러진 수**를 보여준다. dock 상단 보조 설명의
  `카페 N곳`은 **전체 수**를 그대로 유지한다.
- **R6** 검색어를 비우면 카페 전부가 목록과 지도에 돌아온다.
- **R7** 필터 판정은 `lib/cafe-search.ts` 한 곳에만 있다. `CafeListPanel`과
  `CafeMarkers`가 각자 거르지 않는다.
- **R8** 입력칸에 접근 가능한 이름이 있다. 스크린리더가 `카페 검색`으로 읽는다.
- **R9** 검색 입력칸의 시각 규격은 `components/ui/input.tsx`(높이 48px · pill radius ·
  흰 배경 · `outline-variant` 테두리)를 그대로 쓴다. 새 입력 모양을 만들지 않는다.
- **R10** 첫 렌더는 검색어가 빈 상태다. 서버 렌더와 클라이언트 렌더가 갈리지 않는다.
- **R11** 바뀐 동작에 맞춰 `DESIGN.md`, `docs/scope.md`, `components/map/MapView.tsx`
  주석의 "검색바는 아직 없다"는 서술을 갱신한다.

## Acceptance Criteria

- **AC1** dock을 열면 「카페 전체」 제목과 목록 사이에 `동네나 카페 이름` placeholder를
  가진 입력칸이 보인다. → 브라우저 스냅샷 / `CafeListPanel.test.tsx`.
- **AC2** `나루터`를 입력하면 목록에 나루터 한 장만 남는다. `송파`를 입력하면 주소에
  송파가 든 카페만 남는다. → `lib/cafe-search.test.ts` + 브라우저.
- **AC3** `NARUTEO` / ` 나루터 `처럼 대소문자·공백이 달라도 같은 결과가 나온다.
  → `lib/cafe-search.test.ts`.
- **AC4** 검색어를 입력하면 지도에 남는 마커 수가 목록 카드 수와 같다. → 브라우저 확인.
- **AC5** 어느 카페와도 맞지 않는 문자열(`zzzz`)을 넣으면 목록 자리에 한 줄 문구가
  뜨고, 카드는 0장이다. → `CafeListPanel.test.tsx` + 브라우저.
- **AC6** 검색 중 제목 옆 개수는 걸러진 수이고, dock 상단 `오래 앉아 작업하기 좋은
  카페 9곳`은 9 그대로다. → 브라우저 확인.
- **AC7** 입력칸을 비우면 카드 9장과 마커 9개가 모두 돌아온다. → 브라우저 확인.
- **AC8** `getByRole('searchbox', { name: '카페 검색' })`로 입력칸을 잡을 수 있다.
  → `CafeListPanel.test.tsx`.
- **AC9** `npm run verify`가 통과한다 (lint `--max-warnings=0` · typecheck · test).
- **AC10** `DESIGN.md`에서 "**4번 검색바만 남았다**"와 "동작하지 않는 검색바를 먼저
  띄우지 않는다"가 현재 구현을 설명하는 문장으로 바뀌어 있고, `docs/scope.md` 변경
  이력에 2026-08-26 항목이 있다. → `git diff` 확인.

## Verification - Agent

```bash
npm run verify          # lint → typecheck → test
```

목록·마커가 같은 배열을 받는지 코드로 확인한다.

```bash
grep -n "filterCafes" components/map/MapView.tsx components/cafe/CafeListPanel.tsx components/map/CafeMarkers.tsx
```

`CafeListPanel`과 `CafeMarkers`에는 나오지 않고 `MapView.tsx` 한 곳에만 나와야 한다 (R7).

브라우저로 R3·R5를 본다. 개발 서버가 이미 떠 있는지 먼저 확인한다 (포트 3030 고정).

```bash
lsof -i :3030 || npm run dev
playwright-cli open http://localhost:3030
playwright-cli snapshot
playwright-cli find "동네나 카페 이름"
playwright-cli console            # 하이드레이션 경고가 없어야 한다 (R10)
playwright-cli close
```

## Verification - Human

에이전트가 확인하지 못하는 것만 남긴다.

- 검색 중 지도에서 **마커가 실제로 사라지는지** 눈으로 본다. 스냅샷은 카카오맵
  오버레이 안을 읽지 못한다.
- 입력칸이 목록 스크롤과 함께 밀려 올라가지 않고 제자리에 있는지 본다.
- 검색어를 넣어 목록이 짧아졌을 때 dock 높이가 튀지 않는지 본다.
- 559px 미만 좁은 화면에서 입력칸이 dock 폭을 넘지 않는지 본다.
- 결과 0곳 문구의 말투가 `DESIGN.md`의 다른 빈 상태 문구와 어긋나지 않는지 본다.

## Technical Structure And Changes

새 파일 둘, 수정 다섯이다.

| 파일 | 변경 |
|---|---|
| `lib/cafe-search.ts` | **새로 만든다.** `filterCafes(cafes, query): Cafe[]` 하나. 정규화(trim·소문자)와 이름·주소 부분 일치가 여기 전부 있다 (R2·R7). |
| `lib/cafe-search.test.ts` | **새로 만든다.** 대상 파일 옆에 둔다 (`docs/code-guide.md` 3절). |
| `components/map/MapView.tsx` | `MapShell`에 `query` state를 둔다. `filterCafes(cafes, query)` 결과를 `CafeMarkers`와 `CafeListPanel`에 넘긴다. 상단 `카페 {cafes.length}곳`은 원본 배열을 그대로 쓴다 (R5). 검색바 관련 주석을 갱신한다 (R11). |
| `components/cafe/CafeListPanel.tsx` | `query`·`onQueryChange` props를 받는다. `ui/input`을 제목 아래에 렌더한다. 이미 걸러진 `cafes`를 받으므로 **여기서 거르지 않는다** (R7). 0곳 빈 상태를 추가한다 (R4). |
| `components/cafe/CafeListPanel.test.tsx` | 검색 입력칸 렌더·입력 전달·빈 상태 케이스를 더한다. |
| `app/globals.css` | `.cafe-list-panel__search`(입력칸 위아래 여백)와 `.cafe-list-panel__empty`를 더한다. 빈 상태는 `.bookmark-panel__empty`와 같은 규격이다 — 두 상자가 붙어 있어 갈리면 안 된다. |
| `DESIGN.md` · `docs/scope.md` | 검색바 위치·범위 결정과 변경 이력을 적는다 (R11). |

**state를 `MapShell`에 두는 이유.** 검색어가 마커까지 걸러야 하므로(R3), 상태가
`CafeListPanel` 안에 있으면 마커가 그 값을 알 수 없다. 입력칸의 자리는 목록 상자
안이지만 값의 주인은 dock 전체를 쥔 `MapShell`이다.

**`useMemo`를 쓰지 않는다.** 9개짜리 배열의 `filter` 한 번이고, React Compiler가
켜져 있다 (`.claude/rules/ui.md`).

**`CafeMarkers`·`CafeMarker`는 건드리지 않는다.** 넘기는 배열이 짧아질 뿐이다.

## Tasks

- **T1** `lib/cafe-search.ts`에 `filterCafes`를 쓴다 (R2·R7).
- **T2** `lib/cafe-search.test.ts`에 이름 일치·주소 일치·대소문자·앞뒤 공백·빈
  검색어·무결과 케이스를 쓴다 (AC2·AC3).
- **T3** `CafeListPanel`에 `query`·`onQueryChange` props와 `ui/input` 입력칸을 넣는다
  (R1·R8·R9).
- **T4** `CafeListPanel`에 결과 0곳 빈 상태를 넣는다 (R4).
- **T5** `MapShell`에 `query` state를 두고 거른 배열을 목록·마커에 넘긴다.
  상단 `카페 N곳`은 원본 수로 남긴다 (R3·R5·R6·R10).
- **T6** `app/globals.css`에 `.cafe-list-panel__search`·`.cafe-list-panel__empty`를
  더한다 (R9).
- **T7** `CafeListPanel.test.tsx`에 입력칸 렌더·입력 전달·빈 상태 테스트를 더한다
  (AC1·AC5·AC8).
- **T8** `npm run verify`를 돌린다 (AC9).
- **T9** 개발 서버를 띄우고 브라우저에서 AC4·AC6·AC7과 콘솔을 확인한다.
- **T10** `DESIGN.md`(Left Panel 4번·8번, Search Bar, Interaction Rules)와
  `docs/scope.md` 변경 이력, `MapView.tsx` 주석을 갱신한다 (R11·AC10).

## Risks And Open Decisions

**결정된 것 (2026-08-26, 사용자 확인).**

- 검색바 자리는 「카페 전체 목록」 상자 안이다. `DESIGN.md` Left Panel 순서 4번이
  아니다 → 문서를 코드에 맞춘다 (T10).
- 검색은 목록과 마커를 함께 거른다. `DESIGN.md` Interaction Rules에 이미 적혀 있던
  규칙이 이제 구현된다.

**위험.**

| 위험 | 어떻게 다루나 |
|---|---|
| 검색으로 마커가 전부 사라지면 지도가 빈 화면이 된다 | 목록의 0곳 문구가 그 이유를 말한다. 지도 위에 별도 안내를 띄우지 않는다 — 지도 위 UI는 작고 조용하게 둔다 (`DESIGN.md` Do) |
| 상세 패널이 열린 채로 검색해 그 카페가 걸러지면 마커는 사라지고 패널만 남는다 | **그대로 둔다.** 열린 상세를 검색어가 닫으면 사용자가 읽던 것을 시스템이 뺏는다. 패널은 닫기 버튼으로 닫힌다 |
| 북마크 패널은 걸러지지 않아 검색 중에도 전부 보인다 | **의도다.** 북마크는 탐색 도구가 아니라 저장 목록이다 (`DESIGN.md` Interaction Rules) |
| `DESIGN.md`의 "동작하지 않는 검색바를 먼저 띄우지 않는다"가 남으면 문서와 코드가 어긋난다 | T10에서 지운다 |

**열어 두는 것.**

- 카페가 50~100곳으로 늘면 이름·주소 부분 일치만으로 부족해질 수 있다. 초성 검색과
  필터는 그때 사용처를 보고 정한다. 지금 만들지 않는다.

## Implementation Result Report Contract

구현이 끝나면 아래를 보고한다.

1. **바꾼 파일** — 경로와 한 줄 설명. 새 파일과 수정 파일을 나눈다.
2. **요구사항 대응** — R1~R11 각각을 `파일:줄`로 가리킨다.
3. **AC 판정** — AC1~AC10을 통과 / 미확인 / 실패로 적는다. 미확인은 왜 확인하지
   못했는지 쓴다.
4. **검증 출력** — `npm run verify` 실제 출력(테스트 개수 포함)과 브라우저에서 본
   것을 붙인다. "확인했다"만 쓰지 않는다.
5. **문서 갱신** — `DESIGN.md`·`docs/scope.md`에서 바꾼 문단을 가리킨다.
6. **사람이 확인할 것** — Verification - Human 목록 중 남은 항목.
7. **범위 밖 변경** — PRD에 없는데 건드린 것이 있으면 무엇을 왜 건드렸는지 쓴다.
   없으면 없다고 쓴다.

커밋은 요청받았을 때만 한다. 요청받으면 기능(`lib`·`components`), 스타일(`globals.css`),
문서(`DESIGN.md`·`docs/scope.md`)를 나눠서 커밋한다.
