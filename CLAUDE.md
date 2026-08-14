# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> `AGENTS.md`는 `next dev`가 실행될 때마다 자동으로 다시 쓰인다. 직접 편집하지 말 것.

## 프로젝트

카공맵 — 노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. **개인 습작 MVP**(인프런 VC 클래스)이며, 사업화가 아니라 학습이 목적이다.

## 명령어

```bash
npm run dev      # 개발 서버 — 포트 3030 고정
npm run build    # 프로덕션 빌드 (여기서 TypeScript 타입체크가 함께 돌아간다)
npm run lint     # eslint
npm start        # 프로덕션 실행 — 포트 3030 고정
```

- **포트는 3030이다.** 카카오 콘솔 플랫폼 도메인이 `http://localhost:3030`으로 등록되어 있어, 다른 포트로 띄우면 지도가 뜨지 않는다.
- **타입체크는 `npx tsc --noEmit`이 아니라 `npm run build`로 한다.** 단독 `tsc`는 Next.js가 생성하는 전역 타입(`LayoutProps` 등)을 모르기 때문에 실패한다.
- 테스트 프레임워크는 아직 없다.

## 환경변수

`.env.local`에 셋이 필요하다.

| 변수 | 없으면 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 대신 안내 문구가 렌더된다 — 의도된 폴백이다 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`가 즉시 throw한다 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같다 |

Supabase 쪽은 폴백을 두지 않았다. 원본이 하나여야 하는데 조용히 JSON으로 되돌아가면 화면이 실제 DB와 다른 것을 보여주기 때문이다.

`NEXT_PUBLIC_` 접두사이므로 값을 바꾸면 **개발 서버를 재시작해야** 반영된다.

카카오맵 무료 쿼터는 **개발자 계정의 첫 활성화 앱 1개에만** 제공된다. 새 앱을 만들지 말고 기존 앱을 쓴다.

## 아키텍처

### `lib/cafes.ts` — 데이터 이음매 (이 구조의 핵심)

**컴포넌트는 카페 데이터를 직접 가져오지 않는다.** 모든 데이터 접근은 `getCafes()` / `getCafeById()`를 통한다.

원본은 이제 Supabase `places` 테이블이다(`lib/supabase.ts` 경유). JSON에서 DB로 갈아탈 때 컴포넌트는 한 줄도 바뀌지 않았다 — 이 이음매를 열어둔 이유가 그것이다. **이 규칙을 깨면 의미가 사라진다.**

- 앱의 키는 `places.slug`다(`naruteo`). `places.id`(uuid)가 아니다 — `toCafe()`가 `slug`를 `Cafe.id`로 옮긴다.
- `select('*')`를 쓰지 않는다. `COLUMNS` 상수는 **한 줄 리터럴이어야** supabase-js가 결과 타입을 추론한다.
- `app/page.tsx`의 `export const revalidate = 300`이 캐싱을 정한다.

### 카카오맵 SDK 통합

명령형 SDK를 React에 붙이는 부분이라 규칙이 몇 가지 있다.

- **`autoload=false`로 로드하고 `kakao.maps.load()` 콜백 안에서 지도를 만든다.** 자동 로드에 맡기면 하이드레이션 시점과 어긋나 `kakao is not defined`가 산발적으로 발생한다.
- **`next/script`는 `layout.tsx`가 아니라 `KakaoMap.tsx` 안에 있다.** `onReady`로 초기화 시점을 잡아야 해서 스크립트와 지도 생성 코드가 같은 클라이언트 컴포넌트에 있어야 한다.
- **`MapContext`**가 생성된 지도 인스턴스를 하위로 전달한다. `KakaoMap`이 자식을 알지 않아도 되게 하려는 것이다.
- **마커는 기본 `Marker`가 아니라 `CustomOverlay` + `createPortal`이다** (`CafeMarker`). 대표 사진을 원형으로 자르고 테두리를 두르려면 HTML이어야 한다. `MarkerImage`는 이미지를 아이콘에 그대로 얹을 뿐이라 크롭이 안 된다. 어느 쪽이든 cleanup에서 `setMap(null)`을 반드시 호출한다. 빠뜨리면 유령 마커가 남는다.
- **마커의 포탈 컨테이너는 `useEffect`에서 만든다.** 게으른 초기화로 만들면 서버는 `null`, 클라이언트는 포탈을 내놓아 하이드레이션이 깨진다. 마커는 항상 렌더되므로 이 차이가 매번 드러난다.
- **선택된 마커를 위로 올릴 때는 `overlay.setZIndex()`를 쓴다.** 오버레이마다 SDK가 별도 wrapper를 만들기 때문에 CSS `z-index`로는 형제 마커를 넘지 못한다.
- **`KakaoMap`은 `ResizeObserver`로 스스로 `relayout()`한다.** 상세 패널이 열리면 데스크톱에서 지도 폭이 줄어드는데, 알려주지 않으면 타일이 잘린 채 남는다. 패널 상태를 `KakaoMap`까지 내려보내지 않으려고 크기를 직접 본다.
- **`onSelect`는 `useCallback`으로 참조를 고정한다** (`MapView`). 안 하면 렌더마다 마커를 전부 지웠다 다시 만든다.
- `types/kakao.d.ts`는 **직접 작성한 최소 선언**이다. 공식 타입 패키지가 없으므로, 새 SDK API를 쓰면 여기에 먼저 추가해야 한다.

### `lib/openState.ts`

"지금 영업중" 판정. `close_time <= open_time`이면 자정을 넘기는 영업으로 보고 구간을 나눠 OR로 판정한다. 시드에 `12:00~00:00`(나루터)이 실제로 존재하므로 이 경로는 죽은 코드가 아니다. `now`를 주입할 수 있게 열려 있다.

## 데이터

런타임 원본은 Supabase `places` 테이블이다. `data/cafes.json`은 시드 마이그레이션
(`supabase/migrations/20260814000003_seed_places.sql`)을 만드는 입력으로만 남아 있다 —
`node scripts/generate-seed.mjs`로 재생성한다. 현재 9곳(송파·잠실 7 + 강남 2).

**이미 적용한 뒤 JSON을 고쳐도 DB에 반영되지 않는다.** 마이그레이션은 한 번만 돌기 때문에,
그때는 새 마이그레이션을 따로 만들거나 Supabase에서 직접 고쳐야 한다.

- **`id`가 키다.** 이름은 바뀌므로 `name`을 키로 쓰지 않는다.
- `last_verified`는 화면에 "확인일"로 노출된다. **현재 값은 전부 임시로 채운 오늘 날짜이며 실제 확인 시점이 아니다.**
- `types/cafe.ts`의 enum은 시드에 아직 등장하지 않는 값(`few`/`none`/`noisy`/`bad`)까지 열어두었다.

## 문서 (`docs/`)

읽는 순서와 역할이 다르다.

| 문서 | 역할 |
|---|---|
| `scope.md` | 무엇을 만들고 무엇을 미루는지. **미확정 이슈가 여기 있다** |
| `mvp-decisions.md` | 구속력 있는 제약과 그 근거 |
| `implementation-plan.md` | 폴더 구조와 1차 구현 단계 |
| `research-verification.md` | 위 결정들의 조사 근거 |

### 구속력 있는 결정 (뒤집으려면 문서부터 갱신할 것)

- **크롤링 금지.** 카카오맵 API는 응답 데이터의 별도 저장을 약관으로 금지하며 차단이 실제 집행된다. 카페 데이터는 수기 큐레이션으로만 채운다.
- **권역은 송파·잠실.** 초기 지도 중심은 송리단길(`37.5078, 127.1072`).
- **사진은 Supabase Storage(`place-images` 버킷)에 직접 호스팅한다.** 2026-08-14에 뒤집힌 결정이다 — 원래는 "직접 호스팅하지 않고 `naver_place_url`로 넘긴다"였다. 배경은 `mvp-decisions.md` 3절.
  - ⚠️ **현재 올라간 이미지 9장은 연습용 임시본이며 이용 권리를 확인하지 않았다.** 공개 배포 전에 직접 촬영본이나 사용 허가를 받은 사진으로 교체해야 한다.
  - 카카오맵 API 응답에서 온 URL은 넣지 않는다 (크롤링 금지와 같은 이유).
- **데이터 신선도를 숨기지 않는다.** `last_verified`를 UI에 노출하는 것이 명시적 결정이다.

### 열려 있는 결정

- **`work_policy`(카공 허용: 환영/허용/눈치/금지) 도입 여부** — `scope.md`가 "가장 차별적"이라 규정했으나 현재 보류 상태다. `work_fit`은 대용이 아니다(환경 품질 ≠ 매장 정책). **필터 UI를 붙이기 전에 결정해야 한다.**
- **검증할 핵심 가설** — `scope.md` 미확정 이슈 ③.
- **임시 이미지를 무엇으로 교체할 것인가** — 사진 노출 자체는 결정됐다(위 참고). 남은 것은 출처다. 직접 촬영할지, 매장 동의를 받을지 정하지 않았다. **공개 전에 정해야 한다.**
