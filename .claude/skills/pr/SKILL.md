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
6. Draft a PR body with summary, verification, and risks.
7. Commit or push only when the user explicitly asks.

## Rules

- Do not include unrelated worktree changes in a commit or PR.
- Do not invent test results.
- Put user-visible behavior before internal refactors.
- Mention migrations, env changes, feature flags, data scripts, or manual setup.
- If the branch is not ready, say what is missing instead of writing a polished
  PR body that implies completion.

## PR Body Format

```md
## Summary

- ...

## Verification

- ...

## Risk / Notes

- ...
```
