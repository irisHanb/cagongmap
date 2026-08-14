#!/usr/bin/env bash
# 마이그레이션 + 시드를 일회용 Postgres 컨테이너에 적용하고 제약·RLS·제보 흐름을 검증한다.
#
#   ./scripts/verify-schema.sh
#
# Supabase 프로젝트가 필요 없다. supabase/tests/00_stub_supabase.sql이 auth 스키마와
# anon/authenticated 역할을 흉내 내므로, 여기서 통과한다고 해서 실제 Supabase의
# 기본 grant까지 검증된 것은 아니다.
set -euo pipefail

CONTAINER=cagongmap-pg-verify
IMAGE=postgres:16-alpine
DB=cagongmap
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null
until docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; do sleep 1; done

psql_f() { docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

for f in "$ROOT"/supabase/tests/00_stub_supabase.sql \
         "$ROOT"/supabase/migrations/*.sql; do
  echo "▶ $(basename "$f")"
  psql_f -f - < "$f"
done

# 10번은 set local을 쓰므로 단일 트랜잭션(-1)으로 돌린다.
echo "▶ 10_schema_checks.sql"
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -1 -v ON_ERROR_STOP=1 \
  < "$ROOT"/supabase/tests/10_schema_checks.sql
echo "▶ 20_rls_checks.sql"
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 \
  < "$ROOT"/supabase/tests/20_rls_checks.sql

echo "✅ 통과"
