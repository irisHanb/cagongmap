---
paths:
  - "**/*.tsx"
  - "**/*.css"
  - DESIGN.md
  - components.json
---

# 화면을 건드릴 때

**`DESIGN.md`를 먼저 읽는다.** 저장소 루트에 있다. frontmatter에 색·타이포·radius·간격·
그림자·컴포넌트 치수가 토큰으로 있고, 본문이 그 값을 **어디에 쓰고 어디에 쓰지 않는지**를
정한다. 토큰만 보고 본문을 건너뛰면 안 된다 — 금지 항목(`Don't`)이 본문에만 있다.

- **눈대중으로 새 값을 만들지 않는다.** 색·여백·모서리·그림자는 `app/globals.css`의
  `:root`에 있는 토큰에서만 가져온다. placeholder 문구나 버튼 레이블 같은 말투도
  `DESIGN.md`가 기준이다.
- **기준과 어긋나는 변경이 필요하면 코드를 고치기 전에 이유를 먼저 설명한다.**
  무엇이 어떻게 어긋나는지와 왜 그래야 하는지를 말하고 합의한 뒤에 손댄다.
  합의된 예외는 `DESIGN.md`에 반영한다 — 코드만 앞서가면 기준이 죽는다.

## 지금 고정된 것

- **다크 모드는 없다.** 팔레트가 라이트 하나뿐이라 `prefers-color-scheme` 분기를
  만들지 않는다.
- **부정 상태에는 색을 주지 않는다.** 색이 드는 것은 좋은 조건뿐이다(민트).
- **`work_fit`은 마커 테두리 색으로만 쓴다.** 상세에는 넣지 않는다.
- 폰트는 `pretendard` 패키지의 variable + dynamic subset을 `app/layout.tsx`에서 import한다.
- **하드코딩된 색이 허용되는 파일은 `app/global-error.tsx` 하나뿐이다.** 그 파일은
  루트 레이아웃을 대체해서 `globals.css`도 폰트도 닿지 않는다. 거기서 CSS를 import하면
  그 CSS가 못 뜨는 상황에서 화면이 통째로 사라진다.

## 2026-08-15에 뒤집은 규칙 둘

`DESIGN.md`에 이유가 본문으로 적혀 있다. 되돌리기 전에 그것을 읽는다.

- **로그인 전에도 상세의 하트는 보인다.** 원래 "로그인 전에는 북마크 UI를 숨긴다"였다.
  저장할 수 있다는 사실 자체가 로그인의 이유라, 그 입구까지 감추면 로그인할 까닭이
  화면에 남지 않는다. 누르면 로그인 모달이 뜬다.
- **저장/해제 버튼이 dock이 아니라 상세 패널에 있다.** 저장은 사진과 Quick Check를
  보면서 판단하는 일이다.

## Tailwind는 `/admin`에서만

`app/admin/admin.css`에서만 import한다. **`app/globals.css`에 넣으면 preflight가 지도
shell을 무너뜨린다.** 관리자 화면 규칙은 `app/admin/CLAUDE.md`에 있다.

⚠️ **`postcss.config.mjs`가 생기기 전에 띄운 dev 서버에는 Tailwind가 돌지 않는다.**
PostCSS 설정은 서버가 뜰 때 한 번만 읽힌다. 관리자 화면을 고쳤는데 브라우저에서
아무것도 바뀌지 않으면 **먼저 `npm run dev`를 다시 띄운다** — 2026-08-21에 이걸로
"디자인이 적용되지 않는다"를 한참 들여다봤다.

## React Compiler가 error로 막는 둘

effect 안에서 `setState`를 부르는 것(cascading render), 그리고 **렌더 중 ref를 읽는 것**.
"렌더에서 만들고 정리해야 하는 값"(blob URL 같은)에서 둘 다 막히므로, 우회로를 찾기 전에
`useMemo` + cleanup effect가 가능한지부터 본다 (`components/submission/PhotoPicker.tsx` 참고).

## 비어 있는 자리

`DESIGN.md` Left Panel의 **4번 검색바만 비어 있다.** `docs/scope.md`가 검색·필터를 2차로
미뤄둔 그대로다. **동작하지 않는 검색바를 먼저 띄우지 않는다.**
