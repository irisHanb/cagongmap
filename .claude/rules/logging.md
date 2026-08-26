---
paths:
  - lib/log.ts
  - lib/log.test.ts
  - "app/**/actions.ts"
  - "app/**/route.ts"
  - lib/cafes.ts
  - lib/admin/**
---

# 로깅

**로그는 `lib/log.ts` 하나에서 나온다.** 의존성을 더하지 않았다 — Vercel도 `node`도
stdout/stderr 한 줄을 그대로 걷어가므로 JSON 한 줄이면 수집기가 파싱한다.

```ts
log('info', 'admin.place.save', { request_id, user_id, outcome: 'ok', duration_ms });
```

## 어디에 남기나

**저장·수정·삭제, 로그인, 외부 API 호출에는 로그가 있어야 한다.** 지금 붙어 있는 곳:

| 자리 | event |
|---|---|
| `app/auth/callback/route.ts` | `auth.login` |
| `lib/admin/guard.ts` | `admin.access` (거부) |
| `app/admin/places/actions.ts` | `admin.place.save` · `admin.submission.approve` |
| `app/admin/reports/actions.ts` | `admin.submission.reject` |
| `lib/admin/places.ts` | `storage.upload` · `storage.remove` |
| `lib/cafes.ts` | `db.places.list` · `db.places.get` · `db.places.find_by_naver_url` |

- **`event`는 `도메인.동작` 꼴로 고정한다**(`admin.place.save`). 문장을 넣으면 문구를
  다듬을 때마다 대시보드의 집계가 끊긴다.
- **거부·실패는 판정이 모이는 곳 한 군데에 둔다.** 관리자 권한 거부가
  `requireCurator()` 안에 있는 이유가 그것이다 — 액션이 늘어도 빠뜨릴 자리가 생기지
  않는다. 부르는 쪽에서 또 남기지 않는다.
- **되돌릴 수 없는 변경은 성공도 남긴다.** `storage.remove`가 `info`인 이유다. 그
  함수는 실패해도 던지지 않으므로, 로그가 없으면 파일이 새는 것을 알 방법이 없다.

## 무엇을 담나

**시간·흐름·추적값·결과** 넷이 기본이다. `ts`·`level`·`event`는 `log()`가 붙인다.

| 필드 | 값 |
|---|---|
| `request_id` | `requestId()` — 한 요청 안의 로그를 잇는다 |
| `user_id` | uuid만. 이미 손에 있는 값을 넘긴다 |
| `outcome` | `ok` · `error` · `denied` |
| `duration_ms` | 외부 호출이 걸린 시간 |
| `reason` · `code` | 실패했을 때. `code`는 Postgres 오류 코드다 |

- **`user_id`를 얻으려고 `getUser()`를 새로 부르지 않는다.** auth 서버 왕복이 로그
  한 줄 때문에 늘어난다. 관리자 액션은 `requireCurator()`가 돌려준 값을, 로그인은
  교환 결과를 쓴다.
- ⚠️ **`requestId()`는 `headers()`를 읽지 않는다.** 읽는 순간 `app/page.tsx`의
  `revalidate = 300`이 죽고 요청마다 동적 렌더가 된다. React의 `cache`로 요청당 한 번
  만드는 uuid이고(`lib/admin/guard.ts`의 `getCurator`와 같은 방법), 플랫폼의 요청
  id와 잇지 못하는 대신 캐시를 지킨다.

## 민감정보

**API 키·토큰·비밀번호·이메일·전화번호를 로그에 넣지 않는다.** 한 번 새면 수집기에
남아 되돌릴 수 없다.

- 규칙을 사람의 기억에 맡기지 않는다 — `log()`가 `token`·`secret`·`password`·
  `api_key`·`email`·`phone`이 든 **키를 값째로 버린다**(`lib/log.ts`의 `SECRET_KEY`).
- **`code`는 일부러 지우지 않는다.** Postgres 오류 코드(`23505`)가 그 이름으로 오고
  로그에서 가장 쓸모 있는 값이다. 대신 **OAuth `code`는 애초에 넘기지 않는다** —
  세션과 바꿀 수 있는 자격증명이다(`app/auth/callback/route.ts`).
- **사용자가 적은 글을 담지 않는다.** 폼 검증 실패는 항목 개수만, 반려 사유는
  있고 없고만 남긴다.

## 레벨

`LOG_LEVEL`로 정하고, 없으면 **개발은 `debug`, 운영은 `info`다.** 값이 이상하면
조용히 `info`로 떨어진다 — 로그 설정 하나 때문에 앱이 뜨지 않으면 안 된다.

- **성공한 조회는 `debug`다.** 운영에서 걸러지고 문제를 볼 때만 `LOG_LEVEL=debug`로
  연다. 실패는 언제나 `error`(또는 사용자 취소처럼 흔한 것은 `warn`)다.

## ⚠️ 클라이언트 쓰기에는 아직 로그가 없다

**관측이 필요한 로그는 서버에서 남긴다.** `log()`는 브라우저에서도 돌지만 그때는
사용자 콘솔에 찍힐 뿐 수집기에 가지 않는다.

그런데 **북마크·리뷰·제보는 서버를 거치지 않는다** — `lib/bookmarks.ts` ·
`lib/reviews.ts` · `lib/submissions.ts`가 브라우저에서 PostgREST를 직접 부른다. 그래서
제보 제출 같은 쓰기 흐름은 **지금 관측되지 않는다.**

여는 방법은 둘이고 아직 고르지 않았다.

1. `/api/log` route handler를 두고 클라이언트가 그리로 보낸다 — 공개 엔드포인트라
   쓰기 제한이 함께 필요하다.
2. 그 쓰기들을 서버 액션으로 옮긴다 — 이음매 구조는 그대로 두고 호출 위치만 바뀐다.

**어느 쪽이든 관측 하나 때문에 왕복을 늘리는 일이므로, 무엇을 보고 싶은지 정한 뒤에
고른다.**
