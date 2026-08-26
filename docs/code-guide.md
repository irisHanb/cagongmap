# 코드 가이드

이 문서는 이 프로젝트에서 코드를 짤 때 매번 확인할 기준이다. 목표는 똑똑해 보이는 코드가 아니라, 지금 필요한 일을 작게 끝내고 나중에 다시 읽기 쉬운 코드를 남기는 것이다.

## 1. 단순한가 (KISS·YAGNI)

**지금 쓰는 것만 만든다.** 아직 호출하지 않는 옵션, 인자, 설정값, 확장 포인트는 만들지 않는다. 필요해진 시점에 실제 사용처를 보면서 추가한다.

**한 파일에 여러 책임을 섞지 않는다.** 화면, 데이터 가공, DB 접근, 외부 API 호출, 권한 판단은 각각 경계가 달라야 한다. 파일 하나가 화면도 그리고 저장도 하고 외부 호출도 한다면 먼저 나눌 위치를 찾는다.

**추상화는 중복을 줄일 때만 만든다.** "언젠가 바뀔 수 있음"만으로 인터페이스나 래퍼를 만들지 않는다. 같은 모양이 두세 번 반복되고, 바뀌는 이유가 하나로 묶일 때 추상화한다.

나쁜 예:

```ts
type SavePlaceOptions = {
  dryRun?: boolean;
  sendWebhook?: boolean;
  auditMode?: 'quiet' | 'verbose';
};

export async function savePlace(input: PlaceInput, options: SavePlaceOptions = {}) {
  // 지금은 아무 호출부도 옵션을 쓰지 않는다.
}
```

바른 예:

```ts
export async function savePlace(input: PlaceInput) {
  // 지금 필요한 저장 흐름만 둔다.
}
```

나쁜 예:

```tsx
export async function AdminPlacePage() {
  const user = await getUser();
  const place = await fetchNaverPlace();
  await db.from('places').upsert(place);

  return <PlaceForm place={place} user={user} />;
}
```

바른 예:

```tsx
export async function AdminPlacePage() {
  const place = await getAdminPlace();

  return <PlaceForm place={place} />;
}
```

## 2. 경계가 분명한가 (DRY)

**같은 규칙은 한 곳에 둔다.** 권한 기준, 허용 상태값, 검증 규칙, 기본 숫자, 이벤트 이름처럼 기준이 되는 값은 원본을 하나만 둔다. 쓰는 쪽에서는 복사하지 말고 가져다 쓴다.

**경계 밖의 세부사항을 새게 하지 않는다.** 컴포넌트는 DB 행 모양이나 외부 API 응답을 직접 알 필요가 없다. 데이터 접근 계층에서 앱이 쓰는 형태로 바꾼 뒤 넘긴다.

**거부와 실패 판단은 모이는 곳에 둔다.** 같은 조건을 여러 액션이나 컴포넌트에 흩뿌리면 한 군데가 빠진다. 판정이 필요한 위치를 하나로 만들고, 부르는 쪽은 결과만 다룬다.

나쁜 예:

```ts
// app/admin/places/actions.ts
if (user.email !== 'admin@example.com') {
  throw new Error('forbidden');
}

// app/admin/reports/actions.ts
if (user.email !== 'admin@example.com') {
  throw new Error('forbidden');
}
```

바른 예:

```ts
export async function savePlace(input: PlaceInput) {
  const curator = await requireCurator();

  return saveAdminPlace(input, curator.id);
}
```

나쁜 예:

```ts
const openUntil = place.opening_hours?.weekday_text?.[new Date().getDay()];
```

바른 예:

```ts
const openState = getOpenState(place.openingHours, now);
```

## 3. 찾기 쉬운가

**새 파일은 옆 파일의 위치와 이름 규칙을 따른다.** 테스트는 대상 파일 옆에 둔다. admin 관련 코드는 기존 `app/admin`, `lib/admin` 구조를 먼저 본다. 같은 종류의 코드가 이미 있는 위치가 기본값이다.

**이름만 보고 안에 무엇이 있는지 알 수 있게 짓는다.** `utils`, `helpers`, `common` 같은 넓은 이름은 피한다. 파일 이름에는 도메인과 역할이 드러나야 한다.

**가까운 곳에 두되, 공유 기준은 올린다.** 한 화면에서만 쓰는 작은 함수는 그 화면 가까이에 둔다. 여러 곳이 쓰는 규칙과 기준값은 적절한 `lib` 경계로 올린다.

나쁜 예:

```text
components/
  helpers.ts
  common.ts
  misc.ts
```

바른 예:

```text
components/auth/AuthProvider.tsx
components/cafe/CafeCard.tsx
lib/admin/places.ts
lib/openState.ts
```

나쁜 예:

```text
lib/adminStuff.ts
lib/placeThing.ts
```

바른 예:

```text
lib/admin/guard.ts
lib/admin/places.ts
```

## 4. 바로 확인되는가

**주요 기능은 테스트를 같이 작성한다.** 새 규칙, 저장 흐름, 권한 판단, 데이터 변환, 버그 수정에는 해당 동작을 확인하는 테스트가 있어야 한다. 막는 케이스만 두지 말고, 규칙을 지킨 입력이 통과하는 케이스도 함께 둔다.

**수정 뒤에는 빠른 검증을 돌린다.** 코드 변경을 끝냈다면 최소 `npm run typecheck`와 `npm run build`를 실행한다. 테스트를 추가했거나 관련 로직을 바꿨다면 해당 테스트 또는 `npm run test:run`도 돌린다.

**UI를 바꿨다면 실제 화면을 본다.** 빌드 통과와 화면 정상 동작은 다르다. 개발 서버를 띄우고 브라우저에서 바뀐 흐름을 확인한다.

나쁜 예:

```ts
it('rejects invalid status', () => {
  expect(() => parseStatus('deleted')).toThrow();
});
```

바른 예:

```ts
it('rejects invalid status', () => {
  expect(() => parseStatus('deleted')).toThrow();
});

it('accepts valid status', () => {
  expect(parseStatus('approved')).toBe('approved');
});
```

나쁜 예:

```text
코드를 고쳤다.
```

바른 예:

```text
npm run typecheck
npm run build
npm run test:run
```

## 필수 체크리스트

코드를 마치기 전에 아래를 확인한다.

- [ ] 지금 쓰지 않는 옵션, 인자, 설정, 추상화를 만들지 않았다.
- [ ] 한 파일에 화면, 데이터 접근, 외부 호출, 권한 판단을 섞지 않았다.
- [ ] 같은 규칙이나 기준값을 복사하지 않고 한 곳에서 가져다 쓴다.
- [ ] 새 파일의 위치와 이름이 주변 파일의 규칙을 따른다.
- [ ] 파일과 폴더 이름만 보고 역할을 알 수 있다.
- [ ] 주요 기능, 버그 수정, 권한·검증·데이터 변환에는 테스트를 같이 작성했다.
- [ ] 거부 케이스 옆에 정상 통과 케이스도 확인했다.
- [ ] 코드 변경 뒤 `npm run typecheck`를 실행했다.
- [ ] 코드 변경 뒤 `npm run build`를 실행했다.
- [ ] UI 변경이라면 실제 브라우저에서 화면과 흐름을 확인했다.
