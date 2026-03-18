# New Agent Quickstart

Use this file when you assign work to a new agent on Charter.

## Read Order

1. Read `C:\charter\TASKS.md`.
2. Read `C:\charter\docs\agent-work-queue.md`.
3. Read `C:\charter\docs\charter-mvp-plan.md`.
4. Read `C:\charter\MVP-DECISIONS.md`.
5. Find the assigned task ID in the task board.
6. Read only the matching delegation brief plus the files in your scope.

## Minimal Assignment Format

Give every new agent only these six things:

1. Task ID
2. Goal
3. Exact scope or file boundary
4. Dependencies already completed
5. Expected output
6. Done-when condition

If those six items are present, the agent should not need the full conversation.

## Copy-Paste Prompt Template

```md
You are working on Charter.

Read:
- C:\charter\TASKS.md
- C:\charter\docs\agent-work-queue.md
- C:\charter\docs\charter-mvp-plan.md
- C:\charter\MVP-DECISIONS.md

Own task: <TASK_ID>
Goal: <ONE SENTENCE GOAL>
Scope: <FILES OR SUBSYSTEM ONLY>
Dependencies already satisfied: <TASK IDS OR "none">
Expected output: <ARTIFACT TO RETURN>
Done when: <CLEAR COMPLETION CONDITION>

Rules:
- Stay inside the assigned scope unless a small integration edit is required.
- If you touch an external file, explain why.
- Return changed files, tests run, and open questions.
- If a blocker changes architecture or task order, stop and report it.
```

## Recommended Agent Splits

- Frontend data agent: file upload, schema inference, normalization
- Pipeline contract agent: template schema, persisted DTOs, API contract
- Data pipeline agent: transformation engine, calculated fields, and tests
- Frontend workflow agent: no-code builder UI
- Visualization agent: chart mapping and preview
- Sharing agent: save/load/update/clone experience
- Backend/platform agent: Spring Boot routes, env contract, deployment
- Backend persistence agent: Postgres storage, ULID routes, clone/update semantics
- QA/release agent: happy-path validation and sample templates

## Handoff Format

Ask every agent to return:

1. What changed
2. Files changed
3. Tests or validation run
4. Open questions or blockers

This keeps integration simple and makes status updates to the task board predictable.
