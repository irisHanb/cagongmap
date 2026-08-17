---
name: learn
description: |
  Use near the end of a session when a repeated mistake, useful verification
  command, project rule, workflow decision, or skill improvement should be
  preserved for future Claude Code sessions.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - AskUserQuestion
---

# learn

Use this skill after implementation and verification when something should be
remembered by the project.

Do not update durable project rules without user approval.

## Workflow

1. Review what changed, what failed, and what had to be verified.
2. Extract only reusable learnings.
3. Propose a destination for each learning.
4. Ask for approval before editing durable files.
5. After approval, read the target file first.
6. Add the smallest useful rule and avoid duplicates.
7. Run the smallest relevant validation after editing.

## Candidate Destinations

- `CLAUDE.md`: durable Claude Code project behavior.
- `docs/` or specs: product, data, runtime, or operational contracts.
- `.claude/skills/<name>/SKILL.md`: recurring workflow changes.
- A checklist or task-local note: useful but not yet durable enough.

## Candidate Shape

```md
- id: L1
  learning: ...
  destination: ...
  reason: ...
  minimal_edit: ...
  skip_if: ...
```

## Rules

- Keep only lessons likely to matter again.
- Do not memorialize one-off accidents as permanent rules.
- Prefer precise paths and commands over broad principles.
- If the target already says the same thing, skip the edit and report it.
- If a skill is changed, mention how to verify the new skill is loaded.

## Output Format

```md
## Learning Candidates

- ...

## Needs Approval

- ...

## Applied

- ...

## Skipped

- ...
```
