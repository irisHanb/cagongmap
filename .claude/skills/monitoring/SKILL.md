---
name: monitoring
description: 카공맵의 운영 상태를 점검한다. 서비스 데이터(가입·제보·수정 요청), Vercel(배포 상태·runtime error·5XX), Supabase(Auth 실패·저장/조회 에러·RLS 거부)를 읽어 "정상 / 주의 / 확인 필요" 한 줄로 요약하고, 사람이 결정하거나 실행해야 하는 「바로 볼 것」과 원인을 더 조사해야 하는 「재현과 로그 확인이 필요한 항목」으로 나눠 낸다. 사용자가 "모니터링", "운영 상태", "상태 점검", "헬스체크", "지난 24시간", "밤새 별일 없었나", "에러 확인", "배포 상태", "로그 확인", "5XX", "장애 있었어?"를 말할 때 이 skill을 쓴다. 읽기 전용이라 아무것도 바꾸지 않는다. 특정 버그의 원인을 추적하는 것이 아니라 "지금 괜찮은가"를 묻는 흐름이면 이 skill이다.
---

# 카공맵 운영 상태 점검

**읽기만 한다.** `execute_sql`은 `select`만 쓰고, Vercel은 조회 도구만 호출한다.
재배포·롤백·pending 제보 처리는 이 skill이 하지 않는다. 결과를 보고 사람이 결정한다.

이 저장소는 하루 요청이 10~30건이다. 배포한 주소를 개인에게 직접 보내는 것이 유일한
유입 경로이기 때문이다. 그래서 **"에러 0건"이 "서비스가 정상 동작했다"가 아니라
"요청이 들어오지 않았다"인 경우가 많다.** 판정할 때 이 둘을 구분한다.

## 0. 프로젝트 식별자

매번 조회하지 않는다. `.vercel/project.json`은 **이 저장소에 없다.**

| 값 | |
|---|---|
| Vercel team | `team_kRuC5yxLKOc2tZdVZz6psssw` (hanbs-projects, hobby) |
| Vercel project | `prj_H1XfPcPNSOa5YWW1RPtYYnJ0p5YQ` (cagongmap) |
| Supabase ref | `palzceynjixnbqjsagpq` |

식별자가 유효하지 않다는 응답이 오면 그때만 `list_teams` → `list_projects`로 다시
조회하고, 이 표를 고친다.

기본 구간은 **최근 24시간**이다. 사용자가 다른 구간을 지정하면 따르되,
`query_logs`는 **한 번에 24시간까지만** 받으므로 그보다 길면 나눠 호출한다.
시작할 때 `date -u +"%Y-%m-%dT%H:%M:%SZ"`로 현재 시각을 기록하고 구간을 명시한다.

## 1. 수집 — 세 영역을 병렬로

영역 사이에 의존 관계가 없으므로 **한 번에 호출한다.** 순서대로 기다리지 않는다.

### 1-1. 서비스 운영 데이터 (`mcp__supabase__execute_sql`)

```sql
select
  (select count(*) from auth.users where created_at > now() - interval '24 hours') as signups_24h,
  (select count(*) from auth.users) as users_total,
  (select count(*) from public.place_reports where status = 'pending') as reports_pending,
  (select count(*) from public.place_reports where created_at > now() - interval '24 hours') as reports_24h,
  (select count(*) from public.place_edit_requests where status = 'pending') as edits_pending,
  (select count(*) from public.place_edit_requests where created_at > now() - interval '24 hours') as edits_24h,
  (select count(*) from public.place_reviews where created_at > now() - interval '24 hours') as reviews_24h,
  (select count(*) from public.bookmarks where created_at > now() - interval '24 hours') as bookmarks_24h;
```

pending이 0이 아니면 **각 건의 대상 이름과 접수 시각**까지 조회한다. 개수만으로는
무엇을 먼저 처리할지 정할 수 없다.

```sql
select 'report' as kind, id::text, created_at, coalesce(place_name,'(이름 없음)') as label,
       coalesce(array_length(photos,1),0) as photos
  from public.place_reports where status = 'pending'
union all
select 'edit', id::text, e.created_at,
       (select name from public.places p where p.id = e.place_id),
       coalesce(array_length(e.photos,1),0)
  from public.place_edit_requests e where e.status = 'pending'
order by created_at desc;
```

⚠️ **제보 테이블은 둘이다.** `place_reports`(새 장소)와 `place_edit_requests`(수정 요청)를
합쳐서 세지 않는다. 승인 함수와 처리 절차가 서로 다르다.

### 1-2. Vercel

네 개를 호출한다.

| 도구 | 무엇 |
|---|---|
| `get_runtime_errors` (`since: "24h"`) | 에러 클러스터. 가장 먼저 호출한다 |
| `list_deployments` | production 배포의 `state`와 `target` |
| `get_runtime_logs` (`group_by: "statusCode"`) | 상태 코드 분포 |
| `get_runtime_logs` (`level: ["error","warning","fatal"]`) | 앱이 출력한 로그 |

⚠️ **`group_by`는 상위 1개만 출력하고 나머지는 "N distinct values total"로 줄인다.**
`| 200 | 16 |` 아래에 5XX가 가려질 수 있다. **`statusCode: "5xx"`와 `"4xx"`로 각각 한 번씩
더 호출한다.** 분포 표만 보고 "전부 200"이라고 적지 않는다.

⚠️ **`created`는 밀리초 epoch이다.** `date -u -r $((t/1000))`로 변환해 적는다.
응답에 커밋 메시지 전문이 실려 오므로, 보고에는 **sha와 제목 한 줄만** 옮긴다.

경로별 건수가 필요하면 `group_by: "requestPath"`를 한 번 더 호출한다. 상태 코드 합계와
일치하는지 대조할 때도 쓴다.

### 1-3. Supabase 로그 (`mcp__supabase__query_logs`)

⚠️ **`iso_timestamp_start`와 `iso_timestamp_end`를 항상 지정한다.** 생략하면 지정한
구간이 아니라 기본값인 최근 24시간을 읽는다.

⚠️ **`log_attributes`를 통째로 select하지 않는다.** 한 행이 약 2KB라 네 행이면 8KB다.
**쿼리에서 집계까지 끝낸다.**

먼저 어떤 소스가 있는지 조회한다. 소스 목록 자체가 판정 근거다.

```sql
select source, count(*) as n from logs group by source order by n desc
```

| 소스가 없으면 | 뜻 |
|---|---|
| `auth_logs` | **로그인 시도가 0건이다.** "인증 실패 0건"이 아니라 "로그인 시도 0건"이다 |
| `edge_logs` | REST 요청이 0건이다. 앱이 DB를 호출하지 않았다는 뜻이므로 정상이 아니다 |

그다음 소스별로 집계한다.

```sql
-- REST/Storage: 4xx·5xx와 RLS 거부(401/403)가 여기 기록된다
select log_attributes['response.status_code'] as status,
       log_attributes['request.method'] as method,
       log_attributes['request.path'] as path,
       count(*) as n
from logs where source = 'edge_logs'
group by status, method, path order by n desc limit 30

-- Postgres: ERROR와 FATAL만 확인한다. LOG는 checkpoint 기록이다
select log_attributes['parsed.error_severity'] as sev,
       substring(event_message, 1, 200) as msg, count(*) as n
from logs where source = 'postgres_logs'
group by sev, msg order by n desc limit 30

-- PostgREST: 기동과 스키마 캐시 재적재 기록이 대부분이다
select substring(event_message, 1, 150) as msg, count(*) as n
from logs where source = 'postgrest_logs'
group by msg order by n desc limit 20
```

**`edge_logs`가 클라이언트 쓰기를 확인하는 유일한 경로다.** CLAUDE.md 「클라이언트
쓰기에는 아직 로그가 없다」 그대로, 북마크·리뷰·제보는 브라우저가 PostgREST를 직접
호출하므로 앱 로그에 기록이 남지 않는다. 그 요청이 실행됐는지와 실패했는지는
**`edge_logs`의 POST·PATCH·DELETE 행**으로만 확인된다. 쓰기 행이 0건이면 "시도 자체가
없었다"까지 단정할 수 있다. 로그로 확인한 사실이므로 추측 표현을 붙이지 않는다.

### 1-4. Advisor (참고 항목)

`get_advisors(type: "security")`는 **24시간 구간의 기록이 아니라 현재 시점 스냅샷이다.**
운영 상태 항목과 분리해 참고 항목으로 적는다.

⚠️ **보고하기 전에 `docs/security-audit-2026-08-23/README.md`와 대조한다.**
그 문서에서 판정이 끝난 항목(`place_review_counts`는 의도, `rls_auto_enable`은 Supabase
플랫폼 함수)을 새로 발견한 항목으로 보고하지 않는다. **그 문서에 없는 것만** 보고한다.

## 2. 판정 기준

위에서부터 순서대로 확인해 처음 해당하는 등급을 선택한다.

### 확인 필요

사용자가 이미 실패를 겪고 있을 수 있는 상태.

- Vercel 5XX가 1건 이상이다
- `get_runtime_errors`의 에러 클러스터가 1개 이상이다
- 최신 production 배포가 `ERROR` 또는 `CANCELED`다
- Postgres 로그에 `ERROR` 또는 `FATAL`이 있다
- `edge_logs`에 5xx가 있다
- `auth_logs`에 4xx 또는 5xx가 있다

### 주의

지금 실패는 없지만 방치하면 실패로 이어지는 상태.

- pending 검수가 **3일** 이상 미처리다
- `edge_logs`에 401 또는 403이 있다 — RLS가 막은 결과이므로 **정책대로 막은 것인지
  버그인지** 구분한다. 구분되지 않으면 「재현과 로그 확인」으로 내린다
- 4xx가 전체 요청의 **10%** 이상이다
- `docs/security-audit-2026-08-23/README.md`에 없는 advisor WARN이 있다
- **24시간 요청이 10건 미만이다** — 에러가 0건이어도 이 등급이다. 판정할 표본이 없다

### 정상

위 두 등급에 하나도 해당하지 않는다. **요청이 10건 이상일 때만 「정상」만 적는다.**
10건 미만이면 「정상 — 단, 요청 N건이라 판정 표본이 부족합니다」처럼 조건을 함께 적는다.

## 3. 결과 형식

```markdown
## 전체 상태: 정상 / 주의 / 확인 필요
어느 기준에 해당했는지를 값으로 적고, 그 값이 무엇을 뜻하는지 이어서 적는다.
측정 구간: <ISO 시작> ~ <ISO 끝> (KST 병기)

### 서비스 운영 데이터
표 하나. pending이 있으면 대상 이름과 접수 시각까지.

### Vercel
배포 상태 · runtime error · 상태 코드 · 경로별 건수.

### Supabase
Auth · REST 응답 · RLS 거부 · Postgres ERROR/FATAL · 쓰기 요청 건수.

---

### 바로 볼 것
원인이 확인됐고 **사람이 결정하거나 실행해야 하는** 항목.
- `/admin/reports`의 pending 2건 — 접수 후 나흘 경과. 새 카페 제보는 `place_name`이
  비어 있어, 관리자 폼이 네이버 링크만 프리필한다. 상호는 큐레이터가 직접 채워야 한다.

### 재현과 로그 확인이 필요한 항목
실패는 확인됐지만 **원인이 로그 한 줄로 확정되지 않는** 항목. 재현 방법까지 적는다.
- `/cafes` 500 3건 (02:11~02:14Z) — 같은 시간대에 배포 기록이 없다. 배포 id로 범위를 좁혀
  `get_runtime_logs(deploymentId: ...)`를 다시 읽고, 같은 시각 `edge_logs`와 대조한다.
```

- **두 묶음을 나누는 기준은 "원인을 확인했는가"다.** 원인이 확인됐고 남은 작업이 결정과
  실행뿐이면 「바로 볼 것」, 원인을 더 조사해야 하면 「재현과 로그 확인」이다.
  심각도로 나누지 않는다.
- **빈 묶음은 비었다고 적는다.** 「재현과 로그 확인이 필요한 항목: 없습니다. 실패
  이벤트가 0건이라 조사할 대상이 없습니다」로 끝낸다. 채우려고 없는 항목을 만들지 않는다.
- **건수·시각·경로로 적는다.** "에러가 좀 있었어요"가 아니라 "`/cafes` 500 3건,
  02:11~02:14Z"다.
- **값과 그 값의 의미를 함께 적는다.** 수치만 적으면 읽는 사람이 판정을 대신해야 하고,
  해석만 적으면 근거가 없다. 이 skill의 판정은 대부분 해석에서 갈린다.
  - ❌ 값만 — "24시간 요청이 16건입니다."
  - ❌ 해석만 — "표본이 부족합니다."
  - ✅ 둘 다 — "24시간 요청이 16건입니다. 이 표본으로는 '에러 0건'을 정상 동작의
    근거로 쓸 수 없습니다."
  - ✅ 둘 다 — "`auth_logs` 소스가 없습니다. 인증 실패가 0건이라는 뜻이 아니라 로그인
    시도가 0건이라는 뜻입니다."
- **해석에도 비속어와 추상어를 쓰지 않는다.** "표본이 얇다"가 아니라 "표본이 16건이라
  부족하다"이고, "상태가 안 좋다"가 아니라 "5XX가 3건이라 사용자가 실패를 겪었다"이다.
- **확인한 사실과 추정을 한 문장에 넣지 않는다.** 로그로 확인한 것과 "원인은 아마
  이것"을 분리해 적는다.

## 4. 하지 않는 것

- 재배포·롤백·`pause_project`. 상태를 읽는 skill이고 고치는 skill이 아니다.
- pending 제보를 대신 승인하거나 반려하는 것.
- 데이터를 변경하는 SQL. `select`만 쓴다.
- 로그를 반복 조회하는 것. **한 번 읽고 보고한다.** 반복 확인이 필요하면 `/loop`를 쓴다.
