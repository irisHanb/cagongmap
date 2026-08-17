---
name: clarify
description: |
  Use when the user has an idea, feature request, design direction, or product
  problem that is still ambiguous. Ask focused questions before PRD or
  implementation, and turn the answers into a short handoff summary.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - AskUserQuestion
---

# clarify

Use this skill before planning or implementation when the request still has
important ambiguity.

Do not write code, create a PRD, or change files while using this skill unless
the user explicitly asks for notes to be saved.

## Workflow

1. Restate the current goal in 2-4 bullets.
2. Explore the codebase freely as the conversation requires - read any docs,
   code, or config that could answer the question, and follow leads instead of
   asking the user what the repo can answer.
3. Identify the 2-4 decisions that would most change the implementation.
4. Ask one question at a time.
5. For each question, include why it matters and a recommended default.
6. Keep a compact running summary of decisions, assumptions, and deferred items.
7. Stop when a PRD writer could proceed without guessing.

## Question Rules

- Ask the smallest useful question, not a survey.
- Prefer concrete options with tradeoffs.
- Do not ask the user for facts that the repository can answer.
- If the user does not know, choose a tentative assumption and mark it clearly.
- Push on vague words such as simple, fast, MVP, admin, secure, nice, and done.

## Handoff Format

```md
## Current Goal

- ...

## Decisions

- ...

## Assumptions

- ...

## Deferred

- ...

## PRD Input

- Problem:
- Users:
- Scope:
- Non-goals:
- Acceptance signals:
```
