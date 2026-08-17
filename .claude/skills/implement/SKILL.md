---
name: implement
description: |
  Use when the user asks Claude Code to execute an approved PRD or scoped task.
  Read the requirements, create a live checklist, implement the smallest safe
  changes, and keep acceptance criteria and verification evidence tracked.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - Task
  - TaskCreate
  - TaskList
  - TaskGet
  - TaskUpdate
  - TodoWrite
  - AskUserQuestion
---

# implement

Use this skill to implement an approved PRD or a clearly scoped task end to end.

This is the execution counterpart to `prd`.

`implement` owns the loop that drives a task to done, including fixing. It does
not reimplement verification: it delegates judgment to `verify` as the gate of
its loop (see Final Verification). `verify` stays the single source of truth for
*how* to judge done, and can still be run standalone for an independent audit on
any diff.

## Inputs

When the task came from `prd`, read the artifacts under `.dev/<topic-slug>/`:

- `prd.md` - the contract: scope, non-goals, requirements, acceptance criteria,
  tasks, and the verification plan. The acceptance criteria are the rubric the
  verifier checks against.
- `checklist.md` - the task checklist. Adopt it as the live checklist instead of
  regenerating one.
- `context-notes.md` - project grounding. Read it to avoid re-exploring what
  `prd` already established.

If those artifacts do not exist (the user handed a scoped task, linked spec, or
request directly), fall back to that single source document and build the
checklist from it.

## Readiness Check

Before editing code:

1. Read the inputs above (the `.dev/<slug>/` artifacts, or the single source
   document on the fallback path).
2. Identify scope, non-goals, requirements, acceptance criteria, and
   verification.
3. Check `git status --short`.
4. Read the actual files likely to be touched.
5. Stop and ask if required pre-work, credentials, product decisions, destructive
   data changes, or structural approval are missing.

## Live Checklist

Adopt `checklist.md` as the working checklist when it exists. Otherwise create
one from the source document.

Track:

- requirements
- acceptance criteria
- implementation tasks
- verification commands
- browser or runtime QA scenarios
- human checks

Do not mark a task complete until its acceptance criteria have evidence or a
concrete blocker.

### Seed A Structured Task List

When `checklist.md` exists and has 3 or more tasks, seed a structured task list
from it with `TaskCreate` instead of a flat `TodoWrite`. This keeps requirement
traceability, ordering, and evidence attached to each task through the loop.

For each `T<n>` task in `checklist.md`:

1. `TaskCreate` one task. Carry the checklist tags into `metadata`:
   - `metadata.req` - the `(req: ...)` ids.
   - `metadata.ac` - the `(ac: ...)` ids it is responsible for.
   - `metadata.checklistId` - the `T<n>` id, so `after:` can be resolved.
2. After all tasks exist, wire ordering: for each `(after: T1)` tag, set
   `addBlockedBy` on the dependent task pointing at the prerequisite's task id.
3. Leave acceptance criteria and human checks in the markdown checklist; the
   task list tracks the buildable work, the verifier judges the criteria.

Fall back to `TodoWrite` when there is no `checklist.md`, the task count is
small, or the work is a single straightforward change. Do not seed a structured
task list for trivial tasks - the ceremony is not worth it.

## Implementation Loop

Work tasks in dependency order. When using the structured task list, pick the
next task whose `blockedBy` is empty (lowest `checklistId` first); never start a
task that is still blocked.

For each task:

1. Mark it `in_progress` (`TaskUpdate`) before editing, so progress is visible.
2. Re-read the relevant files.
3. Make the smallest change that satisfies the mapped requirement (`metadata.req`).
4. Avoid unrelated refactors.
5. Preserve user-owned worktree changes.
6. Run the smallest useful check after meaningful edits.
7. Verify the mapped acceptance criteria (`metadata.ac`) inline, at the level the
   criterion actually needs - do not defer all verification to the final pass:
   - Machine-checkable criteria (SQL query, `curl`, build, unit test, generated
     output) -> run the check now and capture the real output.
   - Runtime/browser criteria -> exercise the flow now if you can (the same
     `playwright-cli` the verifier would use); if a real prerequisite blocks it
     (e.g. an OAuth login you cannot automate), record it as a concrete blocker
     rather than assuming it passes.
8. Record evidence as you go - store it on the task (`metadata.evidence`: command
   run, file:line, observed result) so the final verifier can build on it instead
   of starting from zero.
9. Mark `completed` only when the mapped acceptance criteria (`metadata.ac`) have
   real evidence or a concrete blocker. Reading the code and assuming it works is
   not evidence. A partial or unproven change keeps the task `in_progress`.

If a new task is needed, add it (`TaskCreate`) only when it maps to an approved
requirement or is pure verification/release hygiene; tag its `metadata.req`. Ask
before adding new product scope or materially changing the approved structure.

## Final Verification

Finish the implementation first. Then, once, delegate the completion verdict to
an independent verifier instead of judging it yourself.

The same context that wrote the change is the worst judge of it. So when the
build is done, spawn a fresh verifier that did not write the code and let it
judge against the acceptance criteria.

1. Spawn one independent verifier subagent with the `Task` tool. Give it:
   - the acceptance criteria from `prd.md` (or the task) as the rubric - **every**
     criterion, not a subset,
   - both the PRD's `Verification - Agent` and `Verification - Human` sections as
     the available methods. The verifier has the same tooling you do, including
     `playwright-cli`, so a criterion filed under `Verification - Human` is not
     automatically out of scope: if a browser/API/DB step can be driven without a
     human, the verifier runs it.
   - the changed scope (`git status --short` / the diff) and relevant files,
   - the evidence you collected while building.
   Instruct it to follow the `verify` skill: judge **each** acceptance criterion
   with the right verification level and report in the `verify` output format - an
   overall verdict plus a per-criterion result (checked / failed / not checked)
   with evidence. A criterion it can only confirm by reading code - never by
   running it - must be reported as `Blocked` (names the missing prerequisite,
   e.g. "needs an authenticated session"), not silently passed. The verifier is
   **report-only - it does not modify code**.
2. Read the verdict. `verify` returns `Pass | Partial | Fail | Blocked` plus the
   per-criterion detail. A `Pass` is only valid if every criterion has real
   evidence; treat a `Pass` that leaves runtime/browser criteria unchecked as
   `Partial` and push the verifier to actually run them.
   - Pass (all criteria met with evidence) -> done.
   - Partial or Fail -> fix the concrete gap (file, line, failing case) the
     verifier named, then run the verifier once more to confirm. Stop after that
     second pass; if it still fails, report the remaining gap rather than looping.
   - Blocked -> stop and report the blocker that needs a human or a decision.
     Surface it as a remaining item; do not bury it under a Pass.

Do not claim completion on a verdict you produced yourself, on skipped
verification, or on a weaker target than the criteria asked for. Report the
concrete gap.

## Final Report

```md
## Status

Done | Partially Done | Blocked

## Changed

- ...

## Acceptance Criteria

- AC1: Met | Not Met | Blocked - evidence

## Verification

- Command or scenario:
- Result:

## Human Check

- ...

## Risks

- ...
```
