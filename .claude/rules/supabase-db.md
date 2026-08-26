---
paths:
  - supabase/migrations/**
  - supabase/tests/**
  - scripts/verify-schema.sh
  - docs/db-schema.md
---

# 스키마와 RLS

## 손대지 않는 것

- **이미 적용된 마이그레이션의 내용을 고치지 않는다.** 틀렸으면 새 파일로 덮고,
  폐기됐으면 내용을 비우되 파일과 버전은 남긴다
  (`20260820113058_submission_images_bucket.sql`이 그 예다).
- **`drop table` · `truncate` · `where` 없는 `delete`를 쓰지 않는다.** 컬럼을 더하는
  마이그레이션이 기존 행을 지우는 일도 없어야 한다.
- **`supabase db reset`을 부르지 않는다.** 이 저장소에 로컬 스택이 없다 —
  `.mcp.json`이 가리키는 것은 운영 프로젝트 하나뿐이라 reset은 운영 데이터를 지운다.
- storage 마이그레이션에서 **`alter table ... enable row level security`와 `grant`를
  쓰지 않는다.** 이미 켜져 있고 이미 grant돼 있으며, `alter table`은 소유자만 되므로
  깨진다. `create policy`와 버킷 insert/upsert는 통과한다.
- **storage 테이블은 SQL로 지울 수 없다**(`storage.protect_delete`가 막는다). 버킷을
  없애는 것은 대시보드나 Storage API로만 된다. 마이그레이션으로 지우려 하지 말 것.

## RLS를 켜는 것이 기본이다

**사용자별 데이터가 들어가는 테이블은 RLS를 켠 상태가 기본이다.** anon 키가 브라우저에
그대로 나가므로, RLS가 꺼진 테이블은 곧 누구나 읽고 쓰는 테이블이다. 켜는 것을 나중으로
미루지 않는다.

- **소유자 컬럼이 있으면 `auth.uid()`와 맞춰 본인 row만 허용한다.** 이 저장소의 소유자
  컬럼 이름은 테이블마다 다르다 — `profiles.id`, `place_reports.submitted_by`,
  `bookmarks.user_id`. 이름을 가정하지 말고 스키마를 먼저 본다.
- **`auth.uid()`는 `(select auth.uid())`로 감싼다.** 감싸야 플래너가 행마다가 아니라
  구문당 한 번 평가한다. 기존 정책이 전부 이 형태이므로 새 정책도 맞춘다.
- **정책 안에서 같은 테이블을 select하면 RLS가 재귀한다.** `profiles.role`을 보는 판정은
  `security definer` 함수(`public.is_curator()`·`public.current_profile_role()`)로 빼두었다.
  역할 기반 정책을 새로 쓸 때 이 함수를 쓴다.
  - ⚠️ **`using (true)`인 동안에는 이 함정이 드러나지 않는다.** 상수 qual이 접혀서
    넘어가기 때문이다. 2026-08-23에 `profiles`의 SELECT 정책을 좁히자 그때까지 멀쩡하던
    `profiles_update_own`이 `infinite recursion detected`로 죽었다 — with check가
    `select p.role from public.profiles p`를 하고 있었다. **정책을 좁힐 때는 그 테이블의
    다른 정책이 자기 테이블을 읽고 있지 않은지 함께 본다.**
- ⚠️ **함수 execute를 회수할 때 `from anon`만 적지 않는다.** `EXECUTE`는 함수가 만들어질
  때 `PUBLIC`에 붙고 `anon`은 그것을 상속하므로, `revoke ... from anon`은 아무 일도
  하지 않는다. **`from public, anon`이라야 하고**, 로그인 사용자에게 필요하면
  `grant execute ... to authenticated`를 뒤에 붙인다. 저장소의 다른 revoke가 전부 그
  형태다. (2026-08-23에 `is_curator`가 이걸로 한 번 새어 있었다)

## 새 테이블을 만들 때

`SELECT` / `INSERT` / `UPDATE` / `DELETE` 넷을 **한 번에 설계한다.** 하나씩 필요할 때
붙이면 어느 동작이 왜 막혀 있는지 아무도 모르게 된다.

| 명령 | 쓰는 절 | 판단 |
|---|---|---|
| `SELECT` | `using` | 공개인지, 본인 것만인지, 운영자만인지 |
| `INSERT` | `with check` | 소유자 컬럼을 남의 uid로 넣지 못하게 막았는지 |
| `UPDATE` | `using` + `with check` | 아래 참고 |
| `DELETE` | `using` | 진짜 지울 수 있어야 하는지, 상태 컬럼으로 대신할지 |

- **`UPDATE`는 `using`과 `with check`를 항상 같이 검토한다.** `using`은 "어떤 row를 고칠
  수 있나", `with check`는 "고친 결과가 허용되나"로 서로 다른 질문이다. `with check`를
  빠뜨리면 본인 row의 소유자 컬럼을 남에게 넘기거나(`profiles.role` 승격처럼) 권한을
  스스로 올리는 경로가 열린다. 실제 예시는
  `supabase/migrations/20260814000002_profiles_and_submissions.sql`의
  `profiles_update_own`, `submissions_update_own_pending`이다.
- **정책이 없는 명령은 거부된다.** 그래서 `DELETE`를 일부러 열지 않는 것도 정당한 설계지만,
  **의도했다는 사실을 주석으로 남긴다.** 빠뜨린 것과 구분되지 않으면 다음 사람이 추가한다.

## 마이그레이션 체크

**`enable row level security`와 policy SQL은 같은 마이그레이션에 함께 들어간다.** 켜기만 하고
정책을 다음 파일로 미루면 그 사이 배포에서 테이블 전체가 잠기고, 정책만 있고 RLS를 안 켜면
정책이 아무 일도 하지 않은 채 통과한다. 둘 다 조용히 틀린다.

```bash
grep -n "enable row level security\|create policy" supabase/migrations/<파일>.sql
./scripts/verify-schema.sh   # 컨테이너에 마이그레이션을 적용하고 anon 권한까지 검사한다
```

정책 요약표는 `docs/db-schema.md`의 "RLS 요약"에 있다. **정책을 바꾸면 그 표도 같이 고친다.**

⚠️ **Supabase MCP `apply_migration`으로 적용했으면 로컬 파일명을 기록된 버전으로 바꾼다.**
MCP는 파일명을 무시하고 자체 타임스탬프로 기록하므로, 그대로 두면 두 가지가 어긋난다.

- `supabase db push`가 이미 적용된 마이그레이션을 다시 적용하려 든다.
- `./scripts/verify-schema.sh`는 **파일명 순서**로 돌기 때문에, 새 파일에 앞선 시각을
  붙이면 아직 없는 테이블을 건드려 깨진다.

```bash
# 적용 뒤 기록된 버전을 확인하고 그 이름으로 바꾼다
select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
mv supabase/migrations/<임시>.sql supabase/migrations/<버전>_<이름>.sql
```
