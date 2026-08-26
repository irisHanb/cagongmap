# Context Notes: dock 카페 목록 검색

코드베이스를 읽어서 확인한 것만 적는다. 구현 에이전트가 다시 찾지 않도록.

## 지금 dock이 어떻게 생겼나

`components/map/MapView.tsx`의 `MapShell`이 dock 전체를 그린다. 순서는
eyebrow → h1 → 보조 설명(`카페 N곳` + `목록으로 보기`) → `AuthDock` →
`카페 제보하기` → `BookmarkPanel` → `CafeListPanel`이다.

- `MapShell`은 이미 `selected`·`form` state를 들고 있다. `query`는 그 옆에 붙는다.
- `cafes`는 `app/page.tsx`의 서버 컴포넌트가 `getCafes()`로 받아 `MapView`에 넘긴다.
  현재 9곳(송파·잠실 7 + 강남 2).
- `dockRef`가 `MapCenterInset`에 dock 크기를 알려준다. 검색으로 목록이 짧아지면
  dock 높이가 바뀌므로 이 계산이 따라오는지 사람이 눈으로 본다.

`components/cafe/CafeListPanel.tsx`는 `cafes`·`onSelect` 둘만 받는다. 안에서
`chipsOf()`로 chip 셋(콘센트·운영시간·소음)을 만들고, 카드 전체가 버튼이며
`BookmarkButton`이 형제로 겹쳐 있다.

## 이 저장소가 지키는 것

- **컴포넌트는 DB·SDK를 직접 건드리지 않는다.** 카페 데이터는 `lib/cafes.ts`를 통한다.
  검색 필터도 같은 이유로 `lib/`에 둔다 — 컴포넌트에 판정 로직을 넣지 않는다.
- **같은 규칙은 한 곳에.** `docs/code-guide.md` 2절. `CafeListPanel`과 `CafeMarkers`가
  각자 거르면 두 경로가 반드시 어긋난다. `lib/cafes.ts` 머리 주석이 북마크에 대해
  같은 말을 한다.
- **지금 쓰는 것만 만든다.** `docs/code-guide.md` 1절. 호출부가 없는 옵션·인자를 만들지
  않는다. `filterCafes`에 `fields` 같은 옵션을 달지 않는다.
- **테스트는 대상 파일 옆에** (`lib/cafe-search.test.ts`). 거부 케이스 옆에 통과
  케이스도 둔다.
- **React Compiler가 켜져 있다** (`.claude/rules/ui.md`). `useMemo`·`useCallback`을
  손으로 달지 않는다. 단, `MapShell`의 기존 `useCallback`들은 `CafeMarker`의
  `useEffect` 의존성이라 그대로 둔다.

## 입력칸 규격은 이미 있다

`components/ui/input.tsx`가 머리 주석에서 **"search-bar도 같은 규격"**이라고 못박아
뒀다 — 높이 48px, pill radius, 흰 배경, `outline-variant` 테두리. 새 스타일을
만들지 말고 이것을 쓴다.

`app/globals.css`에는 `.search-bar` 클래스가 **없다.** grep 결과 0건이다.

## 붙일 자리의 CSS

`app/globals.css` 403-445행.

- `.cafe-list-panel` — `margin-top: var(--sp-md)`, `padding: var(--sp-md)`,
  radius 20px, `outline-variant` 1px, `rgba(255,255,255,0.8)`.
  **북마크 패널(316행)과 같은 규격이다. 두 상자가 위아래로 붙으므로 갈리면 안 된다.**
- `.cafe-list-panel__title` / `__count` — 18px/800, 개수는 14px/700 `on-surface-variant`.
- `.dock-cafe-list` — `max-height: min(420px, 45dvh)`, `overflow-y: auto`,
  `margin-top: var(--sp-sm)`. 559px 미만에서 `30dvh`(539행).
- 빈 상태를 만들 때 참고: `.bookmark-panel__empty`(342행) — `margin-top: var(--sp-xs)`,
  12px/500, `on-surface-variant`.

검색 입력칸은 `.dock-cafe-list`(스크롤 컨테이너) **밖**에 둔다. 안에 넣으면 목록과
함께 스크롤되어 사라진다.

## 문서가 검색바에 대해 뭐라고 적혀 있나 (전부 갱신 대상)

| 위치 | 현재 문장 | 상태 |
|---|---|---|
| `DESIGN.md` 385 | Left Panel 순서 `4. 검색바` | 8번 상자 안으로 옮긴다 |
| `DESIGN.md` 399-404 | "현재 구현 범위는 1-3번, 5-8번" / "**4번 검색바만 남았다**" / "동작하지 않는 검색바를 먼저 띄우지 않는다" | 갱신 |
| `DESIGN.md` 410-411 | "4번 검색바가 나중에 들어오면 브랜드와 로그인 사이에 끼어들어야" | 뒤집힌다 |
| `DESIGN.md` 436 | 「카페 전체 목록」 절 — "**필터도 정렬도 없다**" | 검색은 생기고 필터·정렬은 그대로 없다고 고쳐 적는다 |
| `DESIGN.md` 500 | Search Bar 컴포넌트 절 — 규격과 placeholder | 자리를 명시한다 |
| `DESIGN.md` 738 | Interaction Rules "검색어는 마커 표시 범위를 줄인다" | **그대로 맞다.** 이제 구현된다 |
| `docs/scope.md` 172·187·198 | "검색바는 그대로 2차다" (과거 변경 이력 안) | **고치지 않는다.** 그때 사실이다. 변경 이력에 새 항목을 추가한다 |
| `components/map/MapView.tsx` 주석 | "4번 검색바만 아직 스코프 밖이라 자리를 만들지 않았다" | 갱신 |

`docs/seo-audit-2026-08-21/seo-schema.md` 121-122행이 "검색이 실제로 붙으면
`SearchAction`을 추가한다"고 적어 뒀다. **이번에는 추가하지 않는다** — URL로 검색
결과에 도달할 수 없으므로 스키마가 거짓이 된다. PRD Non-Goals에 근거를 적어 뒀다.

## 테스트 관행

`components/cafe/CafeListPanel.test.tsx`가 본보기다.

- `@/lib/supabase-browser` 하나만 `vi.mock`으로 가짜로 바꾼다. `BookmarkButton`이
  세션을 필요로 하기 때문이다.
- `AuthProvider` → `BookmarkProvider` 순으로 감싸 렌더한다.
- `test/fixtures.ts`의 `makeCafe(overrides)`를 쓴다. 기본값은 이름 `나루터`,
  주소 `서울 송파구 백제고분로 000`, id `naruteo`.
- 사용자 입력은 `userEvent`로 한다.

`filterCafes` 테스트는 `makeCafe`만 있으면 되고 provider·mock이 필요 없다.

## 실행

```bash
npm run verify     # lint(--max-warnings=0) → typecheck → test
npm run dev        # 포트 3030 고정. 카카오 콘솔에 등록된 포트라 바꾸면 지도가 안 뜬다
```

- 띄우기 전에 3030이 이미 물려 있는지 본다 (`lsof -i :3030`).
- `npx tsc --noEmit`을 단독으로 부르지 않는다. `npm run typecheck`가 앞에
  `next typegen`을 붙인다.
- 지도가 뜨려면 `.env.local`에 `NEXT_PUBLIC_KAKAO_MAP_KEY`가 있어야 한다. 없으면
  안내 문구가 뜨는데 그건 의도된 폴백이다.
- 브라우저 확인은 `playwright-cli snapshot`이 기본이다. `screenshot`은 레이아웃·색을
  볼 때만 쓴다.

## 커밋

- **시키지 않은 커밋을 만들지 않는다.** `main`에서 직접 작업한다. 브랜치를 따지 않는다.
- 요청받으면 성격별로 나눈다: 기능 / 스타일 / 문서.
- 메시지는 `type: 한국어 서술체`. 명사로 끝내지 않는다.
  예: `feat: dock 목록 위 검색으로 카페와 마커를 함께 거른다`
