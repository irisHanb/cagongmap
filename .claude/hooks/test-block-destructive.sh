#!/bin/bash
# block-destructive.sh 검사. `bash .claude/hooks/test-block-destructive.sh`
#
# 막는 케이스 옆에 "정상 작업은 그대로 통과한다"를 함께 둔다. 없으면 전부 거부하는
# hook을 넣어도 이 파일이 통과한다 (.claude/rules/tests.md와 같은 규칙).
H="$(dirname "$0")/block-destructive.sh"
pass=0; fail=0

t() { # $1=DENY|PASS  $2=라벨  $3=stdin JSON
  local out got
  out=$(printf '%s' "$3" | "$H" 2>&1)
  if printf '%s' "$out" | grep -q '"permissionDecision": *"deny"'; then got=DENY; else got=PASS; fi
  if [ "$got" = "$1" ]; then pass=$((pass+1)); printf '  ✓ %-5s %s\n' "$got" "$2"
  else fail=$((fail+1)); printf '  ✗ 기대=%s 실제=%s  %s\n' "$1" "$got" "$2"; fi
}
bash_(){ jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
sql_(){ jq -nc --arg q "$1" '{tool_name:"mcp__supabase__execute_sql",tool_input:{query:$q}}'; }
edit_(){ jq -nc --arg p "$1" '{tool_name:"Edit",tool_input:{file_path:$p}}'; }

echo "── .env ──"
t DENY ".env 편집"           "$(edit_ /x/cagongmap/.env)"
t DENY ".env.local 편집"     "$(edit_ /x/.env.local)"
t DENY ".env.production 편집" "$(edit_ /x/.env.production)"
t PASS ".env.example 편집"   "$(edit_ /x/.env.example)"
t PASS "보통 파일 편집"       "$(edit_ /x/lib/cafes.ts)"
t DENY "셸 > .env"           "$(bash_ 'echo K=1 > .env')"
t DENY "셸 >> .env.local"    "$(bash_ 'echo K=1 >> .env.local')"
t DENY "sed -i .env.local"   "$(bash_ 'sed -i "" s/a/b/ .env.local')"
t DENY "cp로 .env 덮어쓰기"   "$(bash_ 'cp /tmp/x .env')"
t DENY "rm .env"             "$(bash_ 'rm .env')"
t PASS ".env.example 쓰기"    "$(bash_ 'echo K= >> .env.example')"
t PASS ".env 읽기"           "$(bash_ 'grep -c KAKAO .env')"

echo "── 통째 삭제 ──"
t DENY "rm -rf 소스 폴더"     "$(bash_ 'rm -rf lib/admin')"
t DENY "rm -rf ."            "$(bash_ 'rm -rf .')"
t DENY "rm -rf ~"            "$(bash_ 'rm -rf ~')"
t DENY "rm -f 파일"          "$(bash_ 'rm -f CLAUDE.md')"
t DENY "체인된 rm -rf"        "$(bash_ 'cd /tmp && rm -rf ~/dev')"
t DENY "rm -rf 여러 대상"     "$(bash_ 'rm -rf .next docs')"
t DENY "git clean -fdx"      "$(bash_ 'git clean -fdx')"
t DENY "git clean -d -f"     "$(bash_ 'git clean -d -f')"
t DENY "find -delete"        "$(bash_ 'find . -name "*.log" -delete')"
t DENY "find -exec rm"       "$(bash_ 'find . -name "*.tmp" -exec rm {} \;')"
t PASS "rm -rf .next/cache"  "$(bash_ 'rm -rf .next/cache')"
t PASS "rm -rf node_modules" "$(bash_ 'rm -rf node_modules')"
t PASS "rm -rf /tmp/x"       "$(bash_ 'rm -rf /tmp/scratch-dir')"
t PASS "rm 한 파일"           "$(bash_ 'rm docs/tmp.md')"
t PASS "git clean -nd (미리보기)" "$(bash_ 'git clean -nd')"
t PASS "find 목록만"          "$(bash_ 'find . -name "*.log"')"

echo "── SQL ──"
t DENY "drop table"          "$(sql_ 'drop table public.places;')"
t DENY "DROP TABLE 대문자"    "$(sql_ 'DROP TABLE places')"
t DENY "drop table if exists" "$(sql_ 'drop table if exists bookmarks')"
t DENY "개행으로 우회"         "$(sql_ 'drop
  table places')"
t DENY "drop schema"         "$(sql_ 'drop schema public cascade')"
t DENY "truncate"            "$(sql_ 'truncate place_reports;')"
t DENY "where 없는 delete"    "$(sql_ 'delete from places')"
t DENY "psql -c drop table"  "$(bash_ 'psql $DB -c "drop table places"')"
t DENY "supabase db reset"   "$(bash_ 'supabase db reset')"
t DENY "apply_migration drop" "$(jq -nc '{tool_name:"mcp__supabase__apply_migration",tool_input:{name:"x",query:"drop table bookmarks"}}')"
t PASS "drop policy"         "$(sql_ 'drop policy if exists places_select on public.places;')"
t PASS "drop function"       "$(sql_ 'drop function if exists public.is_curator();')"
t PASS "drop constraint"     "$(sql_ 'alter table places drop constraint places_photos_check;')"
t PASS "where 있는 delete"    "$(sql_ 'delete from bookmarks where user_id = auth.uid()')"
t PASS "보통 select"          "$(sql_ 'select count(*) from places')"
t PASS "create table"        "$(sql_ 'create table x (id uuid primary key)')"

echo "── 히어독: 실행이지 작성이 아니다 ──"
t PASS "문서에 rm -rf를 적는다"  "$(bash_ "cat > doc.md <<'EOF'
rm -rf 를 쓰지 않는다
EOF")"
t PASS "문서에 git clean -f를 적는다" "$(bash_ "cat > doc.md <<'EOF'
git clean -f 가 막힙니다
EOF")"
t PASS "문서에 drop table을 적는다" "$(bash_ "cat > doc.md <<'EOF'
drop table 은 막는다
EOF")"
t DENY "히어독 앞의 실제 명령은 잡는다" "$(bash_ "rm -rf lib && cat > doc.md <<'EOF'
안전한 글
EOF")"
t DENY "히어독을 셸로 흘려보내면 명령이다" "$(bash_ "cat <<'EOF' | bash
rm -rf /
EOF")"
t DENY "히어독을 psql로 흘려보내면 명령이다" "$(bash_ "cat <<'EOF' | psql \$DB
drop table places;
EOF")"

echo "── 정상 작업 ──"
t PASS "npm run verify"      "$(bash_ 'npm run verify')"
t PASS "git commit"          "$(bash_ 'git commit -m "docs: x"')"
t PASS "verify-schema"       "$(bash_ './scripts/verify-schema.sh')"

echo; echo "통과 $pass · 실패 $fail"
[ "$fail" -eq 0 ]
