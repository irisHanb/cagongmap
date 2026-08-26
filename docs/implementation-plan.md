# 카공맵 — 프로젝트 구조 & 1차 구현 계획

- 작성일: 2026-08-12
- 관련 문서: [scope.md](./scope.md) · [mvp-decisions.md](./mvp-decisions.md)

---

## 1. 확정된 결정

| 항목 | 결정 | 비고 |
|---|---|---|
| **UGC(로그인·제보)** | 구조만 열어두고 **1차는 조회 전용** | 최종 목표엔 포함. 데이터 접근 계층을 `lib/`에 두어 나중에 API/DB로 갈아끼움 |
| **대상 권역** | **송파·잠실** | 기존 시드 9곳 중 7곳이 해당 |
| **데이터 스키마** | **현재 `cafes.json` 필드 유지** + `id`·`last_verified`만 추가 | `work_policy`(카공 허용) 도입은 보류 → 아래 3-3 참고 |
| **스택** | **Next.js App Router + TypeScript** | 포트 **3030** 고정 |
| **지도** | 카카오맵 JavaScript SDK | `mvp-decisions.md` 2-2에서 확정 |

---

## 2. 프로젝트 구조

```
cagongmap/
├── app/
│   ├── layout.tsx            # 루트 레이아웃 (metadata, lang="ko")
│   ├── page.tsx              # 서버 컴포넌트 — getCafes() 호출 후 MapView에 전달
│   └── globals.css
│
├── components/
│   ├── map/
│   │   ├── MapView.tsx       # 클라이언트 진입점 — 선택 상태 보유
│   │   ├── KakaoMap.tsx      # SDK 스크립트 로드 + 지도 인스턴스 생성
│   │   ├── MapContext.tsx    # 생성된 지도 인스턴스를 하위로 전달
│   │   └── CafeMarkers.tsx   # 카페 배열 → 마커 렌더링 + 클릭 핸들링
│   └── cafe/
│       └── CafeCard.tsx      # 마커 클릭 시 뜨는 상세 카드
│
├── lib/
│   ├── cafes.ts              # ★ 데이터 접근 계층 (교체 지점)
│   └── openState.ts          # 영업중 여부 판정
│
├── types/
│   └── cafe.ts               # Cafe 타입 + enum 정의
│
├── data/
│   └── cafes.json            # 시드 데이터
│
├── docs/
├── .env.local                # NEXT_PUBLIC_KAKAO_MAP_KEY (git 제외)
├── .env.example              # 키 없이 받은 사람을 위한 템플릿
├── next.config.ts            # turbopack.root 고정
└── package.json
```

### 2-1. 왜 이렇게 나누는가

**`lib/cafes.ts`가 이 구조의 핵심이다.**

```ts
// 지금
export async function getCafes(): Promise<Cafe[]> {
  return cafesJson as Cafe[];
}

// 나중에 (UGC 도입 시 — 이 파일만 바뀜)
export async function getCafes(): Promise<Cafe[]> {
  const res = await fetch('/api/cafes');
  return res.json();
}
```

모든 컴포넌트는 `cafes.json`을 직접 import하지 않고 **반드시 `lib/cafes.ts`를 통해서만** 데이터를 얻는다.
이렇게 해두면 나중에 로그인·제보를 붙일 때 컴포넌트를 건드리지 않고 이 파일 하나만 교체하면 된다.
"구조만 열어둔다"는 결정의 실체가 이것이다.

**`components/map`과 `components/cafe`를 나누는 이유**: 지도는 카카오 SDK에 강하게 묶인 명령형 코드(마커 생성/제거, 이벤트 리스너)이고, 카페 카드는 순수 표현 컴포넌트다. 성격이 달라 섞이면 테스트도 교체도 어려워진다.

**`lib/openState.ts`를 분리하는 이유**: "지금 영업중"은 `open_time`/`close_time`/`is_24h`와 자정 넘김(`00:00` 마감) 처리가 얽힌 순수 로직이다. 컴포넌트 밖으로 빼면 단독으로 검증할 수 있다.

---

## 3. 데이터

### 3-1. 타입 정의 (`types/cafe.ts`)

```ts
export type OutletLevel = 'many' | 'some' | 'few' | 'none';
export type NoiseLevel  = 'quiet' | 'normal' | 'noisy';
export type WorkFit     = 'good' | 'ok' | 'bad';

export interface Cafe {
  id: string;                 // 추가 — 마커/리스트/상세 연결 키
  name: string;
  address: string;
  lat: number;
  lng: number;
  naver_place_url: string;
  open_time: string;          // "HH:mm"
  close_time: string;         // "HH:mm" — "00:00"은 자정 마감
  is_24h: boolean;
  iced_americano_price: number;
  outlet: OutletLevel;
  wifi: boolean;
  noise: NoiseLevel;
  work_fit: WorkFit;
  tags: string[];
  last_verified: string;      // 추가 — "YYYY-MM-DD"
}
```

현재 시드에 실제로 쓰이는 값은 `outlet: many|some`, `noise: quiet|normal`, `work_fit: good|ok`뿐이다.
타입에는 `few`/`none`/`noisy`/`bad`까지 열어둔다 — 데이터가 늘면 자연히 등장할 값이다.

### 3-2. `cafes.json`에 추가할 것

- `id`: 슬러그 (`naruteo`, `starbucks-seokchon` 등). **`name`을 키로 쓰지 않는다** — 이름은 바뀐다.
- `last_verified`: `mvp-decisions.md` 2-3에서 확정한 신선도 표기용.

### 3-3. 보류된 것 — `work_policy` (카공 허용)

`scope.md`는 "카공 허용(환영/허용/눈치/금지)"을 3대 핵심 필터 중 **가장 차별적**인 항목으로 규정했다.
이번 결정으로 이 필드는 도입하지 않는다. **즉 `scope.md`가 정의한 차별점 하나를 의도적으로 포기한 상태다.**

`work_fit`이 대용으로 보이지만 의미가 다르다 — "작업하기 좋은가"(환경 품질)와 "눈치 안 보고 있어도 되는가"(매장 정책)는 별개다.

→ 1차 구현에는 영향 없다. 다만 필터를 붙이는 2차 단계 전에 이 항목을 되살릴지 결정해야 한다.

### 3-4. 권역 밖 데이터 2곳

`스타벅스 삼성교점`, `테라로사 포스코센터점`은 강남구다. 권역을 송파·잠실로 확정했으므로 엄밀히는 범위 밖이다.
**제안: 삭제하지 않고 그대로 둔다.** 초기 지도 중심만 송리단길로 잡으면 화면에 안 잡힐 뿐이고, 지도를 이동하면 보인다. 9곳뿐인 데이터를 굳이 줄일 이유가 없다.

---

## 4. 카카오맵 SDK 연동 방식

### 4-1. 로딩

`next/script`로 `autoload=false`를 붙여 로드하고, `kakao.maps.load()` 콜백 안에서 지도를 생성한다.

**스크립트는 `layout.tsx`가 아니라 `KakaoMap.tsx` 안에 둔다.** `next/script`의 `onReady` 콜백으로 초기화 시점을 잡아야 하는데, 이를 위해 스크립트와 지도 생성 코드가 같은 클라이언트 컴포넌트에 있어야 하기 때문이다.

```
//dapi.kakao.com/v2/maps/sdk.js?appkey={JS키}&autoload=false
```

`autoload=false` 없이 쓰면 Next.js의 하이드레이션 시점과 SDK 자동 초기화 시점이 어긋나 `kakao is not defined`가 산발적으로 난다. 이 프로젝트에서 가장 자주 밟는 함정이라 처음부터 이 방식으로 간다.

### 4-2. 환경변수

```
# .env.local  (git에 커밋하지 않음)
NEXT_PUBLIC_KAKAO_MAP_KEY=<JavaScript 키>
```

JS 키는 브라우저에 노출되는 것이 정상이다. 대신 **카카오 콘솔의 플랫폼 도메인 등록으로 보호**된다.

### 4-3. ⚠️ 사전 확인 필요

카카오 개발자 콘솔 > 내 애플리케이션 > 플랫폼 > Web에 아래가 등록되어 있어야 한다.

```
http://localhost:3030
```

**포트가 3030이므로 기본값 3000으로 등록해뒀다면 지도가 뜨지 않는다.** 착수 전에 확인할 것.
또한 `mvp-decisions.md` 2-2에 적힌 대로 무료 쿼터는 **계정의 첫 활성화 앱 1개 한정**이므로 앱을 새로 만들지 말고 기존 앱을 쓴다.

---

## 5. 1차 구현 범위 — ✅ 완료 (2026-08-12)

**목표: `cafes.json`을 읽어 카카오맵 위에 마커로 띄우고, 마커를 누르면 상세 카드가 뜬다.**

| 단계 | 내용 | 산출물 |
|---|---|---|
| 1 | Next.js(App Router, TS) 초기화 · 포트 3030 고정 | `package.json`, `app/layout.tsx` |
| 2 | 타입 정의 + `cafes.json`에 `id`/`last_verified` 추가 | `types/cafe.ts`, `data/cafes.json` |
| 3 | 데이터 접근 계층 | `lib/cafes.ts` |
| 4 | SDK 로드 + 지도 렌더 (송리단길 중심) | `components/map/KakaoMap.tsx` |
| 5 | 마커 표시 + 클릭 → 상세 카드 | `CafeMarkers.tsx`, `CafeCard.tsx` |

> 구현 완료. `next build` 통과, `http://localhost:3030` 200 응답 확인.
> **단 마커가 실제로 지도에 그려지는 것은 JS 키를 넣은 뒤에만 확인 가능하다.**

```json
"scripts": {
  "dev":   "next dev -p 3030",
  "start": "next start -p 3030"
}
```

초기 지도 중심: 송리단길 일대 (약 `37.5078, 127.1072`), level 5 전후.

### 1차에 넣지 않는 것

- 필터 UI (`outlet`/`noise`/영업중/가격) → 2차
- 리스트 뷰 → 2차
- 로그인·제보 → 이후 단계 (`lib/cafes.ts` 교체로 진입)
- 마커 클러스터링 → 9곳 규모에선 불필요

---

## 6. 착수 전 확인 사항

1. **카카오 콘솔에 `http://localhost:3030` 등록** (4-3)
2. JavaScript 키 확보 → `.env.local` 작성
3. `scope.md` 갱신 여부 — 현재 문서와 어긋나는 부분:
   - 권역: "강남·홍대·성수 중 1곳" → **송파·잠실**로 확정됨
   - 로그인/UGC: "미룸" → **최종 목표에 포함, 단계적 도입**으로 변경됨
   - 3대 핵심 필터 중 `카공 허용` → **보류**됨 (3-3)
