#!/bin/bash
#
# 되돌릴 수 없는 작업을 실행 전에 막는다 (PreToolUse).
#
# CLAUDE.md의 「⛔ 손대지 않는 것」을 사람의 기억이 아니라 도구가 강제하게 하는 것이
# 목적이다. 막는 것은 셋뿐이고, 각각 왜 막혔는지와 대신 무엇을 할지 함께 낸다.
#
#   1. .env 수정      — git에 없어서 덮어쓰면 되돌릴 방법이 없다
#   2. 통째 삭제      — rm -r/-f · git clean -f · find -delete
#   3. 파괴적 SQL     — MCP가 운영 프로젝트에 직접 붙는다
#
# 여기 없는 것: lint·typecheck·test. 그것은 .githooks/pre-commit이 이미 돌린다.
#
# ⚠️ **검사 대상은 실행이지 작성이 아니다.** 마이그레이션 파일에 drop을 적는 Write는
# 막지 않는다 — 저장소의 drop 23건이 전부 policy·function·constraint·type이고
# 정상적인 마이그레이션이다. 막는 것은 table·schema·database뿐이다.
#
# ⚠️ **정규식은 반드시 변수에 담아 쓴다.** [[ $x =~ [^;]* ]]처럼 대괄호 클래스를
# 리터럴로 적으면 bash가 구문 오류를 내고, 그러면 이 스크립트는 **아무것도 막지 않은
# 채 exit 0으로 통과한다.** 처음 작성했을 때 실제로 그 상태였다.
#
# 고친 뒤에는 .claude/hooks/test-block-destructive.sh로 34가지를 확인한다.

set -uo pipefail

# jq가 없으면 판정할 수 없다. 판정하지 못하는 안전장치는 없는 것과 같으므로 막는다.
if ! command -v jq >/dev/null 2>&1; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"🔴 안전 hook이 jq를 찾지 못해 판정할 수 없습니다. jq를 설치하거나 .claude/settings.json에서 hook을 빼야 합니다."}}'
  exit 0
fi

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

deny() {
  jq -n --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

# 히어독 본문을 걷어낸다.
#
# `cat > x.md <<'EOF' ... EOF`의 본문은 **파일에 적히는 글이지 실행되는 명령이 아니다.**
# 걷어내지 않으면 이 hook이 막는 명령을 문서에 적는 것만으로 막힌다 — 2026-08-26에
# CLAUDE.md에 hook 설명을 적다가 실제로 두 번 걸렸다.
#
# 예외: 히어독을 셸이나 psql로 흘려보내면 그 본문은 데이터가 아니라 명령이므로 남긴다.
RE_HEREDOC_EXEC='<<-?['"'"'"]?[a-z_][a-z0-9_]*.*\|[[:space:]]*(bash|sh|zsh|psql)'
strip_heredoc() {
  local s="$1"
  if printf '%s' "$s" | tr '[:upper:]' '[:lower:]' | grep -qE "$RE_HEREDOC_EXEC"; then
    printf '%s' "$s"; return
  fi
  printf '%s' "$s" | sed "s/<<-\{0,1\}['\"]/<</g" | awk '
    { if (inhd) { if ($0 ~ "^[ \t]*" delim "[\x27\"]?[ \t]*$") inhd = 0; next }
      if (match($0, /<<[A-Za-z_][A-Za-z0-9_]*/)) { delim = substr($0, RSTART+2, RLENGTH-2); inhd = 1 }
      print }'
}

# 한 줄로 눌러 비교한다. 개행이나 연속 공백으로 패턴을 빠져나가지 못하게.
flat() { strip_heredoc "$1" | tr '\n\t' '  ' | tr -s ' ' | tr '[:upper:]' '[:lower:]'; }

RE_DROP_TABLE='drop[[:space:]]+(if[[:space:]]+exists[[:space:]]+)?table'
RE_DROP_BIG='drop[[:space:]]+(if[[:space:]]+exists[[:space:]]+)?(schema|database)|(^|[[:space:]])truncate[[:space:]]'
RE_DELETE='(^|[[:space:]])delete[[:space:]]+from[[:space:]]'
RE_WHERE='[[:space:]]where[[:space:]]'

check_sql() {
  local s; s=$(flat "$1")
  if [[ $s =~ $RE_DROP_TABLE ]]; then
    deny "🔴 테이블 드롭이 막혔습니다.

.mcp.json의 Supabase MCP는 로컬이 아니라 **운영 프로젝트**에 직접 붙습니다
(project_ref=palzceynjixnbqjsagpq). 드롭한 테이블의 데이터는 되돌릴 수 없습니다.

대신 할 것:
  · 컬럼을 더하거나 상태 컬럼을 바꾸는 마이그레이션을 새로 쓴다
  · 폐기하는 테이블은 내용을 비우되 파일과 버전은 남긴다 (.claude/rules/supabase-db.md)

정말 드롭해야 한다면 사용자가 직접 실행해야 합니다.
(drop policy · drop function · drop constraint는 막지 않습니다)"
  fi
  if [[ $s =~ $RE_DROP_BIG ]]; then
    deny "🔴 스키마 드롭 또는 truncate가 막혔습니다.

운영 프로젝트에 직접 붙는 연결입니다. 지운 행은 되돌릴 수 없습니다.
사용자가 명시적으로 지시하고 직접 실행해야 합니다."
  fi
  if [[ $s =~ $RE_DELETE ]] && [[ ! $s =~ $RE_WHERE ]]; then
    deny "🔴 where 없는 delete가 막혔습니다.

테이블의 모든 행을 지웁니다. 사용자가 2026-08-14와 08-15 두 세션에서
\"기존 places 데이터는 삭제하지 마\"를 따로 지시했습니다.

대신 할 것: where로 대상을 좁히거나, 상태 컬럼으로 감춥니다."
  fi
}

RE_ENV_CMD='(>|tee|sed[[:space:]]+-i|cp[[:space:]]|mv[[:space:]]|rm[[:space:]])[^|;&]*\.env([[:space:]]|$|\.)'
RE_ENV_EXAMPLE='\.env\.example'
RE_RM='(^|[[:space:]]|;|&|\|)rm[[:space:]]+(-[a-z]*[rf][a-z]*[[:space:]]+)+'
RE_RM_SAFE='^[[:space:]]*rm[[:space:]]+(-[a-z]+[[:space:]]+)+(\.next[a-z0-9._/-]*|node_modules[a-z0-9._/-]*|\.playwright-cli[a-z0-9._/-]*|\.worktrees[a-z0-9._/-]*|/private/tmp/claude-[^[:space:]]+|/tmp/[a-z0-9._/-]+)[[:space:]]*$'
RE_GIT_CLEAN='git[[:space:]]+clean[[:space:]]+(-[a-z]*[[:space:]]+)*-?[a-z]*f'
RE_FIND_DEL='find[[:space:]].*(-delete|-exec[[:space:]]+rm)'
RE_DB_RESET='supabase[[:space:]]+db[[:space:]]+reset'

case "$tool" in
  Edit|Write|NotebookEdit|MultiEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
    base=${path##*/}
    if [[ "$base" == ".env" || ( "$base" == .env.* && "$base" != ".env.example" ) ]]; then
      deny "🔴 $base 수정이 막혔습니다.

.gitignore가 .env*를 제외하므로 이 파일은 git에 없습니다. 덮어쓰면 카카오·Supabase
키를 되돌릴 방법이 없고, 재발급은 콘솔에서 사람이 해야 합니다.

대신 할 것:
  · 변수 이름과 용도만 바꾸면 되는 것이면 .env.example을 고칩니다 (git에 있습니다)
  · 실제 값이 필요하면 무엇을 어떤 값으로 넣을지 알리고 사용자가 직접 넣게 합니다"
    fi
    ;;

  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    c=$(flat "$cmd")

    if [[ $c =~ $RE_ENV_CMD ]] && [[ ! $c =~ $RE_ENV_EXAMPLE ]]; then
      deny "🔴 셸에서 .env를 건드리는 명령이 막혔습니다.

명령: ${cmd}

.env는 git에 없어 덮어쓰거나 지우면 되돌릴 수 없습니다. 실제 키가 들어 있습니다.

대신 할 것: .env.example을 고치거나, 필요한 값을 알리고 사용자가 직접 넣게 합니다."
    fi

    if [[ $c =~ $RE_RM ]] && [[ ! $c =~ $RE_RM_SAFE ]]; then
      deny "🔴 재귀·강제 삭제(rm -r / rm -f)가 막혔습니다.

명령: ${cmd}

지운 파일은 휴지통에 가지 않고, 커밋되지 않은 작업은 복구할 수 없습니다.

통과하는 대상(빌드 산출물과 임시 폴더)은 이것뿐입니다:
  .next · node_modules · .playwright-cli · .worktrees · /tmp · 스크래치패드

대신 할 것:
  · 한 파일이면 플래그 없이 'rm <파일>' 하나로 지웁니다
  · 커밋된 파일을 되돌리는 것이면 'git checkout -- <파일>'
  · 정말 필요하면 무엇을 왜 지우는지 말하고 사용자가 직접 실행하게 합니다"
    fi

    if [[ $c =~ $RE_GIT_CLEAN ]]; then
      deny "🔴 git clean -f가 막혔습니다.

추적되지 않는 파일을 전부 지웁니다. .env와 아직 커밋하지 않은 새 파일이 함께
사라지고 복구할 수 없습니다.

대신 할 것: 'git clean -nd'로 무엇이 지워질지 먼저 보고 사용자에게 보고합니다."
    fi

    if [[ $c =~ $RE_FIND_DEL ]]; then
      deny "🔴 find로 여러 파일을 지우는 명령이 막혔습니다.

명령: ${cmd}

패턴이 의도보다 넓게 잡히면 무엇이 지워졌는지 나중에 알 수 없습니다.

대신 할 것: -delete 없이 먼저 돌려 목록을 확인하고 사용자에게 보고합니다."
    fi

    if [[ $c =~ $RE_DB_RESET ]]; then
      deny "🔴 supabase db reset이 막혔습니다.

이 저장소에는 로컬 스택이 없습니다. .mcp.json이 가리키는 것은 운영 프로젝트
하나뿐이라 이 명령은 운영 데이터를 지웁니다.

대신 할 것: 스키마를 확인하려면 './scripts/verify-schema.sh'가 컨테이너에
마이그레이션을 적용해 검사합니다. 운영 DB를 건드리지 않습니다."
    fi

    check_sql "$cmd"
    ;;

  mcp__supabase__execute_sql|mcp__supabase__apply_migration)
    sql=$(jq -r '[.tool_input | .. | strings] | join(" ")' <<<"$input")
    check_sql "$sql"
    ;;
esac

exit 0
