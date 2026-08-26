---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
---

# TypeScript

**여기 적는 것은 도구가 잡아 주지 않는 것뿐이다.** 설계 기준(KISS·DRY·경계)은
`docs/code-guide.md`에 있고, 이 파일은 타입을 어떻게 쓰는지만 다룬다.

## 도구가 이미 막는 것 — 다시 적지 않는다

| 무엇 | 무엇이 막나 |
|---|---|
| `any` | eslint `@typescript-eslint/no-explicit-any` — **error** |
| 미사용 변수·import | eslint warning + `--max-warnings=0` → 실패 |
| 암묵적 `any`, null 미검사 | `tsconfig.json`의 `strict: true` |
| 경로 | `@/*` 하나뿐이다. 상대 경로로 `../../`를 타고 올라가지 않는다 |

## `type`과 `interface`를 나눠 쓴다

저장소 48개 선언이 예외 없이 이 기준을 따른다. **새로 쓸 때도 맞춘다.**

| | 쓰는 곳 | 예 |
|---|---|---|
| `type` | 유니언, 파생 타입, 별칭 | `type ReviewValue = 'good' \| 'normal' \| 'bad'`<br>`type CuratorRole = (typeof CURATOR_ROLES)[number]`<br>`type JsonLd = Record<string, unknown>` |
| `interface` | 객체 모양 (Props·State·Input·Row) | `interface CafeCardProps { … }`<br>`interface SavePlaceInput { … }` |

가르는 기준은 **"이름 붙인 객체 한 덩어리인가"**다. 그러면 `interface`, 아니면 `type`.

## `enum`을 쓰지 않는다

**저장소에 TS `enum` 키워드가 0건이다.** 상태값은 전부 문자열 유니언이다.

```ts
// 이렇게 쓴다
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

// 목록이 런타임에도 필요하면 as const에서 파생시킨다
const CURATOR_ROLES = ['curator', 'admin'] as const;
type CuratorRole = (typeof CURATOR_ROLES)[number];
```

이유는 셋이다. **값이 DB 문자열과 그대로 같아 변환이 없고**(`place_reports.status`가
`'pending'`이다), `as const` 배열은 순회할 수 있으며, `enum`은 런타임 객체를 만들어
번들에 남는다.

## `as`와 `!`는 경계에서만

- **non-null 단언 `!`은 저장소에 0건이다.** 새로 만들지 않는다. `strict`가 잡아 준
  자리를 손으로 되돌리는 일이다. 좁히려면 early return이나 옵셔널 체이닝을 쓴다.
- **`as` 단언은 13건이고 전부 같은 모양이다** — 바깥에서 온 넓은 문자열을 우리 유니언으로
  좁힌다. DB row(`profile.role as CuratorRole`), 쿼리스트링(`value as StatusFilter`),
  환경변수(`process.env.LOG_LEVEL as LogLevel`), Radix Select의 `onChange`, DOM API
  (`offsetParent as HTMLElement`).
  - **우리가 만든 값에는 쓰지 않는다.** 우리 코드가 만든 값이 좁혀지지 않는다면 타입이
    틀린 것이지 단언할 일이 아니다.
  - **가능하면 단언 전에 목록으로 확인한다.** `lib/admin/guard.ts:53`과
    `lib/admin/submission.ts:27`이 그 형태다 — `CURATOR_ROLES.includes(value as CuratorRole)`로
    먼저 거른 뒤 쓴다. 확인 없이 단언하면 DB에 새 값이 생기는 날 조용히 통과한다.
- `satisfies`는 저장소에 0건이다. 먼저 쓰기 시작하면 두 방식이 섞이므로, 필요해지면
  그때 이 줄을 고친다.

## import와 export

- **타입만 가져올 때는 `import type`을 붙인다** (저장소 51건). 값과 섞어 가져오면
  `import { foo, type Bar }` 꼴로 인라인 `type`을 쓴다. `isolatedModules`가 켜져 있어
  번들러가 타입 import를 지울 수 있어야 한다.
- **컴포넌트는 `export default function`, 그밖은 named export다.** 저장소가 이렇게
  갈려 있다 — `components/**`와 `app/**`의 페이지는 default, `lib/**`은 default가 0건이다.
- **화살표 함수로 컴포넌트를 만들지 않는다.** `const X = () => …` 꼴이 0건이고
  `export default function X()`가 기본이다. `React.FC`도 쓰지 않는다.

## 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 모듈 상수 | `SCREAMING_SNAKE` | `MAX_PHOTO_BYTES` · `PLACE_COLUMNS` · `STATUS_LABEL` |
| 타입·컴포넌트 | `PascalCase` | `SavePlaceInput` · `CafeMarker` |
| 함수·변수 | `camelCase` | `placeImageUrl` · `resolvePlaceId` |
| 파일 | `kebab-case.ts`, 컴포넌트는 `PascalCase.tsx` | `place-images.ts` · `CafeCard.tsx` |

**`components/ui/`의 10개 파일만 소문자다**(`button.tsx` · `dialog.tsx` …). shadcn/ui가
그 이름으로 생성하고 `components.json`이 그 경로를 가리키므로 바꾸지 않는다. 우리가 쓰는
컴포넌트는 `PascalCase.tsx`다.

**`utils`·`helpers`·`common` 같은 넓은 이름을 새로 만들지 않는다** (`docs/code-guide.md` 3절).
`lib/utils.ts`는 shadcn/ui가 요구하는 `cn()` 한 개짜리 파일이고 예외다.
