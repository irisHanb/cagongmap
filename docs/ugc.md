# 리뷰 · 제보 (UGC)

2026-08-20에 입력이 들어왔고, 검수 화면은 2026-08-21에 `/admin`으로 붙었다
(`app/admin/CLAUDE.md`). 대시보드 SQL 경로도 그대로 살아 있다.

## 제보 테이블은 둘이다. 하나가 아니다

| 테이블 | 담는 것 | 필수 |
|---|---|---|
| `place_reports` | 새 장소 제보 | `naver_place_url` |
| `place_edit_requests` | 기존 장소 수정 요청 | `place_id` |

원래 `place_submissions` 하나가 `kind`로 셋을 겸했는데, 필수 항목이 서로 달라 공통
컬럼이 `payload jsonb` 하나뿐이었다. **가른 이유가 그것이다** — 한 테이블에 두면
둘 다 nullable이 되고 DB가 아무것도 보장하지 못한다. 2026-08-20에 갈랐고
`place_submissions`·`approve_submission()`·`submission_kind`는 없앴다.

## `place_reports.place_name`은 선택 입력이다

2026-08-21에 더했다. 네이버 링크에서 상호를 자동으로 뽑을 방법이 없어서 제보자에게
직접 받는다 — `naver.me/XXXX`는 `map.naver.com/p/entry/place/<id>`로 307 리다이렉트하는데
그 주소에 이름이 없고, 최종 페이지는 2.3KB짜리 JS 셸이라 `<title>`도 `og:title`도
비어 있다. 뽑으려면 헤드리스 브라우저가 필요한데 `map.naver.com/robots.txt`가 봇을
막고, 무엇보다 **크롤링 금지**가 구속력 있는 결정이다.

- **필수로 만들지 않는다.** 이름을 몰라도 링크만으로 제보할 수 있어야 한다.
- **확인된 상호가 아니라 검수의 출발점이다.** 승인 함수가 이 값을 `places`로
  옮기지 않는다 — 관리자 폼이 기본값으로 깔아 주고 최종 판단은 큐레이터가 한다.

## ⚠️ `lib/submissions.ts`의 검사는 안내이지 방어선이 아니다

anon 키가 브라우저에 나가므로 그 파일을 건너뛰고 PostgREST를 직접 부를 수 있다.
2026-08-23에 같은 규칙을 DB로 내렸다 — 네이버 도메인·메모 2000자·사진 5장은 check
제약이, 검수 컬럼 위조와 "남의 검수 폴더 사진 담기"는 insert 정책의
with check(`own_submission_photos()`)가 막는다.

**한쪽만 고치지 않는다** (`docs/security-audit-2026-08-23/README.md`).

## 리뷰 집계는 RPC로만 읽는다

**`place_review_counts()`를 쓴다.** `place_reviews`를 직접 select하면 누가 어디에
`bad`를 눌렀는지가 통째로 나온다. 테이블 select는 본인 행만 열려 있다.

## 승인 함수는 카페를 만들지도 고치지도 않는다

두 테이블 어느 쪽도 `places`를 채울 만큼의 정보를 담지 않기 때문이다(제보는 URL·사진·
메모, 수정 요청은 사진·메모). 큐레이터가 `places`를 직접 만들거나 고친 뒤 함수로
연결·기록만 한다. **신규 제보는 그것만으로 카페가 되지 않는다.** 폼이 그 사실을
사용자에게 말한다.

- `approve_place_report(제보id, 카페id, 승인자uuid?)` — 만든 카페에 연결하고 `approved`로.
- `approve_edit_request(요청id, 승인자uuid?)` — `places.last_verified`를 오늘로 옮긴다.
- `reject_place_report(id, 사유, 승인자uuid?)` / `reject_edit_request(id, 사유, 승인자uuid?)`

함수가 **사진까지 붙인다.** 제보의 공개 URL을 경로로 되짚어 `places.photos`에 이어
붙이고(이미 있으면 건너뛴다), 상태와 확인일을 갱신한다.

### ⚠️ 세션이 없으면 승인자를 인자로 넘겨야 한다

대시보드 SQL 편집기·psql·service_role은 세션이 없어 `auth.uid()`가 NULL이고, 그러면
`is_curator()`가 false다 — 인자가 없던 시절 운영 스크립트의 승인은 **한 번도 성공할 수
없었다.** 판정은 `resolve_reviewer()` 한 곳에 있고 `coalesce(auth.uid(), …)` 순서라,
세션이 있으면 인자는 무시된다. 로그인한 비큐레이터가 인자로 남을 사칭하는 경로는
열리지 않는다.

## 승인은 SQL 한 줄로도 된다. 키도 스크립트도 필요 없다

```sql
-- 새 장소 제보: 카페를 먼저 만들고(제보에는 이름·주소·좌표가 없다) 연결한다
select public.approve_place_report('<제보id>', '<카페id>', '<큐레이터uuid>');
-- 정보 수정 요청: places를 직접 고친 뒤
select public.approve_edit_request('<요청id>', '<큐레이터uuid>');
```

## 데이터 접근 계층

`lib/reviews.ts`·`lib/submissions.ts`가 그 자리이고 **둘 다 브라우저 전용이다.**
사진 규칙은 `docs/images.md`, 파일 판정은 `lib/photo-rules.ts`에 있다.
