---
name: verify
description: |
  Use before declaring a task complete, after code/content/config changes, or
  when the user asks to verify, QA, smoke test, validate, or inspect whether
  something really works. Inspect the changed scope, run the right checks,
  verify runtime behavior when needed, and report evidence without inventing
  results.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

# verify

Use this skill when the work looks done but needs proof.

The job is not to celebrate completion. The job is to decide whether the change
can be accepted, based on evidence.

This skill is the single source of truth for *how* to judge done. It is used two
ways:

- As the completion gate of `implement`: once `implement` finishes building, it
  spawns an independent verifier that follows this skill to judge the acceptance
  criteria.
- As a separate standalone pass after `implement`, when the user wants additional
  confidence, runtime QA, or an independent completion audit on any diff.

Either way the job and the rules are the same: judge from evidence, do not fix.

## What This Skill Does

`verify` answers four questions:

1. What changed?
2. What could have broken?
3. What did we actually check?
4. What risk remains?

Do not modify code, content, or config while using this skill. `verify` is
read-only: it reports evidence and a verdict, it does not fix what it finds. If
verification surfaces a bug, describe it precisely (file, line, failing case) and
hand it back to `implement` or the user to fix.

## Verification Levels

Use the smallest level that covers the real risk. Move wider only when needed.

### Level 1. Static Checks

Use when the change could break syntax, types, lint rules, content parsing, or
the build.

Examples:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- project-specific validators such as `verify:content`

### Level 2. Behavior Checks

Use when the change has expected behavior that can be tested or inspected
without relying only on human taste.

Examples:

- unit tests for pure logic
- integration tests for data loading or API behavior
- smoke scripts
- migration or seed verification
- checking generated output files

### Level 3. Runtime QA

Use when the result depends on the real app, browser, API, database, logs, or
external service configuration.

Examples:

- open the local or deployed route
- click the changed flow
- check visible text and state
- inspect console or network errors
- call the API endpoint
- verify database rows or counts
- capture screenshot, DOM, log, or command evidence

Use `playwright-cli` for browser QA. If it is not installed, install it first
(see https://github.com/microsoft/playwright-cli) or fall back to the project's
configured browser tooling.

### Level 4. Adversarial Subagent Review

Use when the same context that produced the change cannot be trusted to judge
it, because the change is large or the risk of a confident-but-wrong "Pass" is
high. The goal is to defeat self-verification bias: a fresh agent that did not
write the change, and does not share its assumptions, is harder to fool.

Trigger Level 4 only when at least one is true:

- the diff is large or spans many files (rough rule: 5+ files or 200+ changed
  lines)
- the change touches security, auth, money, data migration, or destructive
  operations
- Level 1-3 passed but the result still feels fragile, or a single judgment
  would carry a lot of weight
- the user explicitly asks for a deep, independent, or adversarial review

Do not trigger Level 4 for small, low-risk changes (a one-line fix, a copy
tweak, a lint cleanup). A council of skeptics on a trivial diff is waste.

How to run it:

1. Frame each thing you are about to call "Pass" as an explicit claim, e.g.
   "the new auth guard rejects expired tokens" or "the migration is reversible".
2. For each high-stakes claim, spawn independent skeptic subagents with the
   `Task` tool. Give each one the claim, the relevant files/diff, and the
   evidence you already collected, then instruct it to **try to refute the
   claim**, not to confirm it. Run skeptics for separate claims in parallel
   (multiple `Task` calls in one message).
3. Each skeptic returns: `refuted` or `not_refuted`, plus a concrete reason. A
   refutation only counts if it names a specific failing case, file, line, or
   reproduction. "Might be risky" with no concrete case does not count as a
   refutation.
4. Decide by majority. For a claim, run an odd number of skeptics (1, 3) and
   take a claim as holding only if a majority returns `not_refuted` with no
   concrete counterexample surfaced. Any concrete, reproducible refutation flips
   that claim to Fail regardless of vote count.

Subagents inherit the Evidence Rules below. Tell each skeptic that it may only
report a refutation it actually demonstrated (ran the case, read the line),
never one it imagined. A subagent's unverified claim is not evidence, the same
way yours is not.

Guard against endless skepticism: instruct skeptics that absent a concrete
counterexample the default verdict is `not_refuted`. The job is to find a real
break, not to withhold approval on vague doubt.

## Workflow

1. Run `git status --short` and identify the changed files.
2. Read the relevant diff or files. Do not rely on memory.
3. State the intended behavior in one or two sentences.
4. List the main risks introduced by the change.
5. Choose Level 1, 2, and/or 3 checks that cover those risks.
6. Run the checks. Prefer focused checks first.
7. If a check fails, decide whether it is caused by this change, pre-existing,
   or unrelated.
8. If UI/runtime changed, inspect the real route or runtime target.
9. If the change is large or high-stakes (see Level 4 triggers), spawn
   adversarial skeptic subagents on the key claims before settling the verdict.
10. Report only evidence you actually collected.
11. Say what remains unchecked.

## Evidence Rules

- A command is evidence only if it actually ran.
- A browser check is evidence only if the route, state, and observed result are
  named.
- A database check is evidence only if the target environment and query/result
  are named.
- A screenshot is evidence only if the path or captured view is named.
- "Looks good" is not evidence by itself.
- Do not hide skipped checks. Explain why they were not run.

## Failure Handling

When a check fails:

- quote or summarize the important error line
- say whether it appears related to the current change
- if unrelated, name the file/command that proves it is outside scope
- if related, report it as a Fail with the failing file/line/case so `implement`
  or the user can fix it; do not fix it here
- if blocked, stop and report the blocker clearly

Do not keep rerunning broad checks when a narrower failure already explains the
problem.

## Verdict Rule

The verdict must reflect what was actually checked, not what looks done.

- `Pass` only when **every** acceptance criterion has real evidence at the level
  its risk demands. A criterion that depends on runtime, browser, API, or
  database behavior is met only when that behavior was actually exercised - not
  when the code merely looks correct.
- If any criterion is still unchecked or could only be confirmed by reading code,
  the verdict is at most `Partial` - or `Blocked` if a real prerequisite (e.g. an
  authenticated session, missing credentials) stopped you from running it.
- Never fold an unchecked criterion into a `Pass`. An item in `Not Checked` or a
  runtime criterion you skipped caps the verdict below `Pass`. Report it openly
  instead of rounding up.

## Output Format

```md
## Verdict

Pass | Partial | Fail | Blocked

## Checked

- ...

## Evidence

- Command:
- Result:
- Runtime:
- Result:

## Adversarial Review

(Include only when Level 4 ran. Omit otherwise.)

- Claim:
- Skeptics: N run, M refuted
- Outcome: held | broken (with the concrete counterexample)

## Failed Or Blocked

- ...

## Not Checked

- ...

## Remaining Risk

- ...
```
