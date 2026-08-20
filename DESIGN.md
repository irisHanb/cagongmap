---
name: Cagong Map
description: 지도 위에서 오래 앉아 작업하기 좋은 카페를 검색하고, 로그인 후 개인 북마크로 저장하는 서비스.
colors:
  surface: "#fffaf8"
  surface-dim: "#e4dad6"
  surface-bright: "#fffdfb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f9f2ef"
  surface-container: "#f3eae7"
  surface-container-high: "#ece0dd"
  surface-container-highest: "#e4d7d3"
  on-surface: "#211b1a"
  on-surface-variant: "#5b504d"
  outline: "#92817d"
  outline-variant: "#e2d5d1"
  primary: "#88484a"
  on-primary: "#ffffff"
  primary-container: "#e8c5c2"
  on-primary-container: "#683638"
  secondary: "#606851"
  on-secondary: "#ffffff"
  secondary-container: "#dce4cc"
  tertiary: "#2f6f67"
  on-tertiary: "#ffffff"
  tertiary-container: "#b9dcd5"
  work-fit-good: "#2f6f67"
  work-fit-ok: "#e2d5d1"
  work-fit-bad: "#92817d"
  soft-coral: "#d9918e"
  pastel-mint: "#d8f1ec"
  positive-text: "#214f49"
  warm-cream: "#fffef9"
  text-main: "#47403e"
  kakao: "#FEE500"
  naver: "#03c75a"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 28px
    fontWeight: 800
    lineHeight: 36px
    letterSpacing: 0
  detail-title:
    fontFamily: Pretendard Variable
    fontSize: 26px
    fontWeight: 800
    lineHeight: 32px
    letterSpacing: 0
  section-title:
    fontFamily: Pretendard Variable
    fontSize: 18px
    fontWeight: 800
    lineHeight: 28px
    letterSpacing: 0
  body:
    fontFamily: Pretendard Variable
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: 0
  label:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0
  eyebrow:
    fontFamily: Pretendard Variable
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0.12em
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  panel: 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
shadows:
  brew: "0 18px 42px -24px rgba(50, 37, 34, 0.34)"
  marker: "0 10px 20px -13px rgba(35, 25, 25, 0.5)"
  marker-selected: "0 0 0 7px rgba(136, 72, 74, 0.2), 0 15px 28px -14px rgba(35, 25, 25, 0.62)"
components:
  left-panel:
    width: 390px
    backgroundColor: "{colors.surface}/95"
    rounded: "{rounded.panel}"
    padding: 20px
    shadow: "{shadows.brew}"
  search-bar:
    backgroundColor: "{colors.surface-container-lowest}"
    borderColor: "{colors.outline-variant}"
    rounded: "{rounded.full}"
    height: 48px
  kakao-login:
    backgroundColor: "{colors.kakao}"
    textColor: "rgba(0,0,0,0.85)"
    rounded: "{rounded.full}"
    height: 48px
  bookmark-panel:
    backgroundColor: "rgba(255,255,255,0.8)"
    borderColor: "{colors.outline-variant}"
    rounded: 20px
  detail-panel:
    backgroundColor: "{colors.surface}"
    rounded: 32px
    widthDesktop: 400px
  naver-link:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    brandTextColor: "{colors.naver}"
    rounded: "{rounded.full}"
    height: 36px
  fact-card:
    backgroundColor: "{colors.warm-cream}"
    borderColor: "{colors.outline-variant}"
    rounded: 16px
  map-marker:
    backgroundColor: "{colors.warm-cream}"
    rounded: "{rounded.full}"
    size: 46px
    borderWidth: 2px
    borderColorFrom: work_fit
    shadow: "{shadows.marker}"
    shadowSelected: "{shadows.marker-selected}"
---

## Overview

카공맵은 카페 탐색 앱이지만, 현재 화면의 1차 목적은 리스트를 훑는 것이 아니라 **지도 위에서 위치를 보고, 필요한 순간에만 상세를 열어 판단하는 것**이다. 그래서 좌측 패널은 검색과 로그인만 남기는 방향으로 줄였고, 조건 필터와 후보 리스트는 제거했다.

핵심은 따뜻한 카페 무드는 유지하되, UI 바탕은 더 조용하고 도구답게 만드는 것이다.

## Design Direction

**Warm, quiet, map-first.**
카페라는 도메인의 온기는 `warm-cream`, 살짝 붉은 `primary`, 둥근 패널로 만든다. 하지만 화면의 대부분은 지도이므로 UI 색은 지도와 경쟁하지 않아야 한다. 큰 장식, 큰 CTA, 반복 카드, 다색 배지는 피하고, 검색·로그인·북마크·상세 확인에 필요한 최소 표면만 띄운다.

현재 방향은 다음과 같다.

- 지도는 항상 주 화면이다.
- 좌측 패널은 `브랜드/검색/로그인` 중심의 작은 dock이다.
- 로그인 전에는 dock의 북마크 **패널**을 숨긴다. 다만 상세의 하트는 보인다 — 저장할 수 있다는 사실 자체가 로그인의 이유이므로, 그 입구까지 감추면 로그인할 까닭이 화면에 남지 않는다 (2026-08-15 변경).
- 로그인 유도는 화면당 하나다. 하트·리뷰·제보 어느 것을 눌러도 같은 모달 하나가 뜨고, dock에는 유도를 겹쳐 두지 않는다.
- 로그인 후에는 기본 프로필과 북마크 기능만 보여준다.
- 카페 상세는 큰 사진, 주소, 이름, 네이버 지도 보조 링크, Quick Check, 태그, 리뷰 순서로 구성한다.
- **운영자가 확인한 사실(Quick Check)과 사용자 신호(리뷰)를 섞지 않는다.** 위아래로 갈라 두어야 어느 쪽을 보고 있는지 헷갈리지 않는다 (2026-08-20 추가).
- “카공 적합도” 같은 큰 평가 카드는 상세에서 제거한다. 실제 판단 신호는 Quick Check에 모은다.

## Color System

기존의 blush/coral 톤은 카페 무드는 좋았지만 전체가 너무 달콤하고 무거워 보였다. 현재 팔레트는 같은 계열을 유지하되 더 흰 표면과 낮은 채도의 브릭 톤으로 조정한다.

- `surface (#fffaf8)`: 앱 패널과 상세의 기본 배경. 완전 흰색보다 따뜻하지만 붉게 보이면 안 된다.
- `surface-container-*`: skeleton, fact icon, muted chip 등에만 사용한다. 넓은 면적에 반복해서 깔면 지저분해진다.
- `primary (#88484a)`: 브랜드 eyebrow, 선택 상태, 주요 아이콘, 에러 메시지에만 사용한다. 큰 배경으로 남발하지 않는다.
- `pastel-mint (#d8f1ec)`: 좋은 조건을 표시하는 작은 positive state 전용이다.
- `kakao (#FEE500)`: 카카오 로그인 버튼 전용 예외 색.
- `naver (#03c75a)`: 네이버 지도 링크의 작은 `N` 배지 전용 예외 색.

색 사용 원칙:

- 외부 브랜드 색은 큰 CTA 색으로 확장하지 않는다.
- 민트는 좋은 조건의 아이콘 배경에만 사용한다.
- 버건디/브릭 톤은 제목보다 상태와 구조를 잡는 데 사용한다.
- 지도 위 UI는 반투명 흰 표면과 약한 그림자로 띄운다.

### 다크 모드는 두지 않는다

팔레트는 이 따뜻한 라이트 세트 하나뿐이다. `prefers-color-scheme: dark` 분기를 만들지 않는다.
색이 온기를 담당하는 팔레트라 그대로 반전하면 카페 무드가 사라지고, 습작 범위에서 두 세트를
따로 관리할 이유가 없다.

### 부정 상태에는 색을 주지 않는다

팔레트에 negative 토큰은 없다. 이는 누락이 아니라 결정이다. `영업종료`, `콘센트 없음`처럼
좋지 않은 조건은 빨강을 새로 만들지 말고 `surface-container` 배경 + `on-surface-variant`
글자로 눕힌다. **색이 드는 것은 좋은 조건뿐이다.**

### `work_fit` — 마커 테두리 전용

좋음에만 색을 주고 나머지는 무채색으로 눕힌다. 긍정에만 색을 주는 위 원칙과 같은 결이다.

| `work_fit` | 테두리 | |
|---|---|---|
| `good` | `work-fit-good #2f6f67` | tertiary — 깊은 틸 |
| `ok` | `work-fit-ok #e2d5d1` | outline-variant |
| `bad` | `work-fit-bad #92817d` | outline |

선택된 마커는 `work_fit`과 무관하게 `primary` 테두리로 덮어쓴다. 색만으로 뜻을 전달하면
안 되므로 같은 값을 마커의 `title`·`aria-label`에 글로도 넣는다.

## Typography

폰트는 Pretendard Variable을 직접 싣는다. 현재 UI는 정보량이 적기 때문에 타이포 위계를 과하게 만들 필요가 없다.

싣는 방법은 `pretendard` npm 패키지의 **variable + dynamic subset**이다
(`app/layout.tsx`에서 `pretendardvariable-dynamic-subset.css`를 import).
유니코드 구간별로 92조각이라 브라우저가 실제로 쓰는 글자 구간만 내려받는다. 정적 웨이트
파일을 셋 얹으면 쓰지 않는 글자까지 2.3MB를 받게 되므로 그 방식은 쓰지 않는다.

- 앱 제목 `카공맵`: 28px / 800 / line-height 36px.
- 상세 제목: 26px / 800 / line-height 32px.
- 섹션 제목: 18px / 800.
- 본문과 메타: 12-16px 범위에서 사용한다.
- letter spacing은 기본 0이다. 단, `WORK CAFE MAP`, `QUICK CHECK` 같은 eyebrow만 0.12-0.16em을 허용한다.

한국어 UI에서는 긴 단어가 버튼 안에서 눌리지 않게 버튼 높이와 padding을 먼저 확보한다. 폰트 크기를 viewport 기준으로 늘리지 않는다.

## Layout

### Map Shell

메인 화면은 `100dvh` 풀스크린 지도다. 모든 UI는 지도 위에 뜨는 overlay로 취급한다.

### Left Panel

좌측 패널은 데스크탑에서 `390px` 폭, 좌상단 `16px` 오프셋, `28px` radius를 기준으로 한다.

구성 순서:

1. Eyebrow: `WORK CAFE MAP`
2. H1: `카공맵`
3. 보조 설명: `오래 앉아 작업하기 좋은 카페 N곳`
4. 검색바
5. 카카오 로그인 또는 로그인 사용자 정보
6. `카페 제보하기` 진입점
7. 로그인 후 북마크 패널

제거된 요소:

- 후보 카페 리스트
- `조건 빠르게 고르기`
- 필터 chip 묶음

이 패널은 탐색 결과를 모두 보여주는 곳이 아니라, 지도 탐색을 시작하고 개인 상태로 들어가는 entrance다.

**현재 구현 범위는 1-3번, 5-7번이다.** 5번 카카오 로그인과 7번 북마크가
2026-08-15에, 6번 제보 진입점이 2026-08-20에 들어왔다
(`scope.md` 변경 이력, `mvp-decisions.md` 3절).

**4번 검색바만 남았다.** `scope.md`가 필터·리스트를 2차로 미뤄둔 그대로다.
동작하지 않는 검색바를 먼저 띄우지 않는다.

지금 순서는 브랜드 블록 → 로그인 → 제보 → 북마크 패널이다. 4번 검색바가 나중에
들어오면 브랜드와 로그인 사이에 끼어들어야 위 순서가 맞는다.

6번 제보는 **로그인 전에도 보인다.** 상세의 하트와 같은 이유다 — 제보할 수 있다는
사실 자체가 로그인의 이유이므로 그 입구까지 감추면 로그인할 까닭이 줄어든다.
누르면 폼 대신 로그인 모달이 뜬다.

### Detail Panel

상세 패널은 데스크탑 우측, 모바일 하단 sheet에 가깝게 동작한다. 현재 데스크탑 폭은 `400px`다.

구성 순서:

1. Hero image
2. 주소
3. 카페명
4. `지도에서 보기` 네이버 보조 링크
5. Quick Check
6. 자리와 분위기 힌트
7. 리뷰 (`좋아요` / `보통` / `별로` + 집계)
8. 확인일 (`last_verified`)
9. `정보가 다른가요?` 수정 요청 진입점

주소가 카페명보다 위에 온다. eyebrow처럼 지역을 먼저 읽히게 하려는 의도다.

8번 확인일은 이 화면의 장식이 아니라 **지켜야 하는 항목**이다. `mvp-decisions.md` 2-3이
데이터 신선도를 숨기지 않는 것을 결정으로 두고 있다. 구분선 아래 가장 작은 글씨로 두되,
빼지는 않는다.

`work_fit`은 여기 넣지 않는다. 추상 평가 대신 실제 판단 신호를 Quick Check에 모으고,
`work_fit`은 마커 테두리 색으로만 쓴다.

7번 리뷰는 **Quick Check 아래**이고 그 사이에 구분선을 둔다. Quick Check는 운영자가
확인한 사실이고 리뷰는 사용자 신호라, 붙여 두면 같은 종류로 읽힌다. 리뷰가 Quick
Check의 값을 바꾸지도 않는다.

9번 수정 요청은 확인일 **아래**의 작은 텍스트 버튼이다. "이 정보가 언제 확인된
것인가" 다음에 오는 물음이 "지금은 다른데요"이므로 그 자리에서 고칠 길을 연다.
CTA로 키우지 않는다 — 상세의 주인공은 카페다.

`지도에서 보기`는 primary CTA가 아니다. Quick Check 바로 위에 작은 pill로 두고, 초록색은 `N` 글자에만 적용한다.

## Components

### Search Bar

검색바는 지도 탐색의 유일한 필터 진입점이다. 높이는 48px, pill radius, 흰 배경, 약한 border를 사용한다. placeholder는 `동네나 카페 이름`처럼 행동을 바로 설명한다.

### Kakao Login

카카오 로그인은 로그인 전 유일하게 큰 색이 들어가는 버튼이다. 카카오 공식 노란색을 쓰되, 버튼 외곽 장식은 최소화한다. border도 그림자도 얹지 않는다 — 색만으로 충분하다. 로그인 후에는 프로필 avatar, 이름, 이메일, 로그아웃 아이콘만 보여준다.

**이메일은 없을 수 있다.** 카카오에서 이메일은 선택 동의항목이라 넘어오지 않는 계정이
있다. 그럴 때는 자리를 비워두지 말고 줄 자체를 뺀다. avatar도 마찬가지로 없으면 이름
첫 글자를 `primary-container` 위에 얹는다.

세션 판정이 끝나기 전에는 버튼도 프로필도 그리지 않는다. 로그인 버튼이 떴다가 프로필로
바뀌는 깜빡임을 만들지 않으려는 것이다.

로그인 실패 문구는 버튼 아래 12px 회색 한 줄이다. **실패에 색을 주지 않는다** — 색이
드는 것은 좋은 조건뿐이라는 규칙이 여기에도 적용된다.

### Bookmark Panel

북마크 패널은 로그인 후에만 노출한다.

패널 안에서는 다음만 보여준다.

- `BOOKMARKS` eyebrow
- `내 북마크`
- 저장 개수
- 저장된 카페 목록 (이름 + 주소, 두 줄)

**저장/해제 버튼은 여기 없다.** 2026-08-15에 상세 패널의 하트로 옮겼다. 저장은 카페를
보면서 판단하는 일이라 판단 재료(사진·Quick Check) 옆에 있어야 하고, dock에 두면 카페를
고른 뒤 시선을 반대편으로 옮겼다가 돌아와야 한다.

개수는 조회가 끝나기 전에는 보여주지 않는다. `0`을 띄웠다가 숫자가 바뀌면 저장한 적이
없다고 잘못 읽힌다.

북마크 목록은 후보 리스트의 대체물이 아니다. 개인 저장 목록이므로 과하게 사진 카드화하지
않는다. 목록이 길어지면 패널이 늘어나는 대신 목록 안에서 스크롤한다 — dock이 지도를
가리는 높이까지 자라면 안 된다.

### Bookmark Heart

상세 패널의 하트는 카페명과 **같은 줄** 오른쪽 끝에 둔다. 상세 구성 순서(1-7번)에 항목을
새로 끼워 넣지 않으려는 것이다.

- 저장 전: 40px 원형, 흰 배경, `outline-variant` 테두리, `outline` 선 아이콘.
- 저장 후: `primary-container` 배경에 `primary` 채운 하트.
- 크기와 위치는 상태와 무관하게 고정한다. 채움만 바뀌어야 눌렀을 때 레이아웃이 흔들리지 않는다.

하트는 로그인 전에도 보인다. 이때 누르면 저장하지 않고 로그인 모달을 띄운다.

### Modal

모달은 **두 종류뿐이다.** 로그인 안내와 제보 폼이다.

원래 "모달은 로그인 안내 하나뿐"이었고, 2026-08-20에 제보가 들어오면서 뒤집었다.
사진을 여러 장 올리는 폼을 400px 상세 패널이나 390px dock 안에 넣으면 모바일에서
손이 갇히기 때문이다. 대신 **폼 모달은 한 껍데기로만 늘린다** — 종류를 더 만들지 않는다.

공통 규격:

- Scrim: `rgba(33, 27, 26, 0.42)` + `blur(3px)`
- Panel: `surface`, `{rounded.panel}`, `{spacing.lg}` padding, `{shadows.brew}`
- 제목 18px/800, 본문 14px `on-surface-variant`
- Escape·배경 클릭·취소 셋 다로 닫힌다.

| | 로그인 안내 | 제보 폼 |
|---|---|---|
| 최대 폭 | 320px | 420px |
| 액션 | 카카오 로그인 + `나중에` | `보내기`(primary) + `취소` |
| 본문 | 왜 로그인이 필요한지 한 문단 | 폼 필드 |

로그인 안내 문구는 **방금 누른 것에 따라 갈린다**(북마크·리뷰·제보). 하나로 뭉뚱그리면
왜 필요한지가 사라진다.

모달을 확인 대화상자로 늘리지 않는다. 북마크 해제에도, 리뷰 해제에도 확인을 받지
않는다 — 되돌리는 비용이 한 번 더 누르는 것뿐이다.

### Review Chips

상세의 리뷰는 같은 크기 chip 세 개다. 높이 40px, pill radius, 가로를 균등하게 나눈다.

- 선택 전: 흰 배경, `outline-variant` 테두리, `on-surface-variant` 글자.
- 선택 후(`좋아요`): `pastel-mint` 배경 + `positive-text`.
- 선택 후(`보통`·`별로`): `surface-container-high` 배경 + `on-surface`. **색을 주지 않는다.**

`별로`에 빨강을 주지 않는 것은 이 문서의 규칙이다 — **색이 드는 것은 좋은 조건뿐이다.**
크기와 위치는 상태와 무관하게 고정한다. 채움만 바뀌어야 눌렀을 때 줄이 흔들리지 않는다.

집계는 chip 아래 12px 회색 한 줄이다.

- 평가가 없으면 `0`을 나열하지 않고 `아직 평가가 없어요. 첫 평가를 남겨보세요`로 적는다.
  카페 9곳 대부분이 그 상태이고, `좋아요 0 · 보통 0 · 별로 0`은 정보가 아니라 소음이다.
- 하나라도 있으면 셋을 모두 적는다. **좋은 것만 보여주면 집계가 아니라 광고가 된다.**
- 조회가 끝나기 전에는 숫자를 말하지 않되 줄 높이는 비워 둔다. 나중에 끼어들며 아래를
  밀어내지 않게 한다.

### Submission Form

제보 폼(수정 요청·새 장소)이 함께 쓰는 규격이다.

- 입력: 높이 48px, pill radius, 흰 배경, `outline-variant` 테두리. 메모는 `{rounded.md}`.
- **사진은 브라우저 기본 파일 입력을 쓰지 않는다.** 회색 `파일 선택` 버튼과 영문
  `No file chosen`이 이 화면에서 유일하게 OS 위젯처럼 보인다. 입력은 숨기고 같은
  규격의 레이블(48px · pill · `outline-variant` · `surface-container-low` 배경)을
  누르게 한다. 배경을 한 단계 눌러 "쓰는 칸"이 아니라 "누르는 자리"로 읽히게 했다.
  - 문구는 `사진 고르기`, 이미 고른 뒤에는 `사진 더 고르기`.
  - 오른쪽 힌트는 고르기 전 `최대 5장 · 5MB까지`, 고른 뒤 `2 / 5장`.
  - 드래그가 올라오면 테두리만 `primary`로 바뀐다. 새 색을 만들지 않는다.
  - 아이콘은 Quick Check와 같은 규격이다 — 16px, `currentColor` stroke, 라이브러리 없음.
- 사진 썸네일: 64px 정사각에 `{rounded.md}`와 `outline-variant` 테두리, 좌상단이 아니라
  **우상단 모서리에 걸친** 22px 원형 × 버튼(`on-surface` 배경, hover에 `primary`).
- `보내기`는 이 화면에서 **primary 색을 쓰는 두 번째 버튼**이다(첫째는 카카오 로그인).
  둘이 같은 화면에 동시에 보이지 않으므로 CTA가 경쟁하지 않는다.
- 보낼 내용이 없으면 `보내기`는 비활성이다. 누르고 나서 혼내지 않는다.
- 실패 문구는 12px 회색 한 줄이다. **실패에 색을 주지 않는다.**
- 보낸 뒤에는 같은 모달이 `보냈어요`로 바뀐다. 확인 후 반영된다는 사실을 여기서 말한다 —
  제보가 바로 지도에 뜨지 않는 것을 고장으로 읽지 않게 하려는 것이다.

### Map Marker

마커는 46px 원형, 실제 카페 이미지 썸네일을 사용한다. border color는 `work_fit` 상태에서 오지만, 선택 상태만 `primary`로 강조한다. 모든 마커를 강한 색으로 칠하지 않는다.

### Detail Quick Check

Quick Check는 상세 판단의 핵심이다. `콘센트`, `소음`, `와이파이`, `영업시간`, `아메리카노`를 fact card로 보여준다.

Positive condition은 `pastel-mint` icon background와 `positive-text`를 쓴다. 그 외 fact는 neutral surface container와 primary icon을 쓴다.

무엇이 positive인지는 다음으로 고정한다.

| fact | positive 조건 |
|---|---|
| 콘센트 | `outlet === 'many'` |
| 소음 | `noise === 'quiet'` |
| 와이파이 | `wifi === true` |
| 영업시간 | 지금 영업 중 |
| 아메리카노 | **없음 — 늘 중립** |

가격에 positive를 주지 않는 이유는 얼마가 싼지 기준이 없기 때문이다. 기준 없이 색을 주면
민트가 의미를 잃는다.

영업시간은 다섯 번째라 카드 한 줄을 다 쓴다. 값에 상태와 시간을 함께 적는다
(`영업중 · 08:00 - 22:00`).

### Naver Map Link

네이버 지도 링크는 `Quick Check` 바로 위의 작은 보조 pill이다.

- Text: `지도에서 보기`
- Brand mark: 작은 `N`
- Height: 36px
- Background: white
- Border: outline-variant
- Text color: on-surface-variant

금지:

- 큰 `네이버 지도` CTA로 만들기
- 버튼 전체를 네이버 초록색으로 칠하기
- 주소 옆에 붙여 레이아웃을 복잡하게 만들기

## Interaction Rules

- 마커 클릭 시 상세 패널을 연다.
- 상세 패널이 열리면 데스크탑 xl 이하에서는 좌측 패널을 숨겨 지도/상세 충돌을 줄인다.
- 검색어는 마커 표시 범위를 줄인다.
- 선택된 마커는 scale up과 primary border로 표시한다.
- 로그인 전에도 상세의 하트는 보인다. 누르면 저장 대신 로그인 안내 모달이 뜬다.
- 로그인 후 선택된 카페를 저장/해제할 수 있다. 저장/해제 버튼은 dock이 아니라 **상세 패널**에 있다 (2026-08-15 변경).
- 북마크 목록에서 카페를 고르면 상세가 열린다. 지도를 그 카페로 옮기지는 않는다 — 목록은 탐색 도구가 아니라 저장 목록이다.
- 모달은 Escape·배경 클릭·`나중에`(폼에서는 `취소`) 셋 다로 닫힌다. 막다른 골목을 만들지 않는다.
- 리뷰는 로그인 전에도 보인다. 누르면 저장 대신 로그인 안내 모달이 뜬다 (하트와 같은 규칙).
- 리뷰는 1인 1건이다. 같은 값을 다시 누르면 해제되고, 다른 값을 누르면 그쪽으로 옮겨간다.
- 리뷰와 북마크는 누른 즉시 반응한다(낙관적 갱신). 실패하면 되돌리고 사유를 한 줄로 적는다.
- 제보 모달은 지도 위에서 열린다. 상세 패널이나 dock 안에 끼워 넣지 않는다.
- 제보한 내용은 바로 지도에 반영되지 않는다. 확인을 거친다는 사실을 폼과 완료 화면에서 말한다.

## Do

- 지도 위 UI는 작고 조용하게 둔다.
- 브랜드 색은 작게, 의미 있는 곳에만 쓴다.
- 외부 브랜드 색은 해당 버튼/배지 안에서만 제한적으로 쓴다.
- 판단 정보는 Quick Check에 모은다.
- 상세의 네이버 지도 링크는 보조 액션으로 둔다.
- 사진이 시각적 무게를 담당하게 하고, UI 배경은 밝게 유지한다.
- 사용자가 보낸 것(리뷰·제보)과 운영자가 확인한 것(Quick Check·확인일)을 화면에서 갈라 둔다.

## Don't

- 좌측 패널에 리스트와 필터를 다시 많이 쌓지 않는다.
- 큰 CTA를 여러 개 만들지 않는다.
- `카공 적합도`처럼 추상 평가 카드를 상세 상단에 크게 두지 않는다.
- 네이버 초록, 카카오 노랑, primary, mint가 모두 큰 면적으로 경쟁하게 만들지 않는다.
- 둥근 카드 안에 또 카드가 들어가는 구조를 만들지 않는다.
- 버건디를 큰 배경과 큰 텍스트에 동시에 남발하지 않는다.
- `별로`·실패·빈 상태에 경고색을 주지 않는다. 색이 드는 것은 좋은 조건뿐이다.
- 평가 개수를 별점이나 큰 숫자로 키우지 않는다. 표본이 한 자릿수인 동안 그것은 과장이다.
- 제보 폼에 콘센트·소음 같은 구조화된 필드를 늘어놓지 않는다. 그 값은 운영자가 확인해 매긴다.
