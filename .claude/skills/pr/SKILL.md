---
name: pr
description: |
  Use when preparing changed work for a pull request. Inspect git status and
  diff, keep unrelated work out, summarize the change, gather verification
  evidence, and draft a concise PR title and body.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Edit
---

# pr

Use this skill after implementation and verification, when the work needs to be
reviewed or shipped through a pull request.

## Workflow

1. Run `git status --short`.
2. Inspect the diff for the intended files.
3. Identify unrelated local changes and keep them out of the PR.
4. Confirm which verification commands or runtime checks actually ran.
5. Draft a short PR title.
6. If the change touches UI, capture before/after screenshots (see UI
   Screenshots).
7. Draft a PR body with summary, verification, and risks.
8. Commit or push only when the user explicitly asks.

## Rules

- Do not include unrelated worktree changes in a commit or PR.
- Do not invent test results.
- Put user-visible behavior before internal refactors.
- Mention migrations, env changes, feature flags, data scripts, or manual setup.
- If the branch is not ready, say what is missing instead of writing a polished
  PR body that implies completion.
- A UI change needs before/after images. A diff does not show what the screen
  looks like.

## UI Screenshots

`app/**` · `components/**` · `*.css`를 건드렸으면 **before/after 이미지를 본문에
넣는다.** 화면 변화는 diff로 읽히지 않는다.

- 로컬에서는 `playwright-cli`로 찍는다 (CLAUDE.md 「검증」). 개발 서버는 포트
  3030이고, 띄우기 전에 이미 물려 있는지 확인한다.
- **after를 찍고 base로 돌아가 before를 찍는다.** 서버를 겹쳐 띄우지 않는다.
- ⚠️ **base로 체크아웃하기 전에 찍은 파일을 먼저 커밋한다.** 추적되지 않은 이미지를
  두고 브랜치를 옮기면 `git stash -u`에 딸려 들어가 사라진다.
- ⚠️ **한 장이 200KB를 넘기지 않는다.** 지도 화면을 PNG로 찍으면 장당 900KB라 PR
  하나에 3.5MB가 저장소에 들어간다. `sips`로 줄인다 — `sips -s format jpeg
  -s formatOptions 68 -Z 1100 in.png --out out.jpg`. 넉 장을 넘기지 않는다.
- 파일은 `docs/pr-shots/<브랜치>/`에 두고 커밋한다. 본문에는 **커밋 SHA로 고정한
  raw URL**로 건다 — 브랜치 이름으로 걸면 머지 후 이미지가 깨진다. 본문을 쓰기 전에
  `curl -s -o /dev/null -w "%{http_code}"`로 200인지 확인한다.
- **여러 상태를 바꿨으면 상태마다 한 쌍씩** 찍고, 무엇을 찍었는지 표 위에 한 줄 적는다.
  before에 대응 화면이 없으면(기능 자체가 없던 경우) after만 두고 그렇다고 적는다.
- **찍지 못했으면 찍은 척하지 않는다.** 왜 못 찍었는지 한 줄로 적는다.
- **로그인이 필요한 화면은 로그아웃 상태까지만** 찍는다. 카카오 계정으로 대신
  로그인하지 않는다.

## PR Body Format

`## 화면`은 UI를 건드린 PR에만 넣는다.

```md
## Summary

- ...

## 화면

| Before | After |
|---|---|
| <img src="https://raw.githubusercontent.com/OWNER/REPO/<SHA>/docs/pr-shots/.../before-1-default.jpg" width="420"> | <img src="...after-1-default.jpg" width="420"> |

## Verification

- ...

## Risk / Notes

- ...
```
