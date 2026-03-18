# Charter Task Board

Updated: 2026-03-17

This is the practical day-to-day view of Charter work.

- For the full product plan, use `docs/charter-mvp-plan.md`.
- For machine-readable task data, use `docs/task-registry.json`.
- For agent pickup briefs, use `docs/agent-work-queue.md`.

## Status Legend

- `todo`: defined, not started
- `in_progress`: actively owned
- `blocked`: waiting on a dependency or decision
- `review`: ready for verification or integration
- `done`: accepted into the starter repo

## Snapshot

- Total tasks: 11
- Done: 2
- In review: 8
- In progress: 0
- Ready now: 1
- Blocked by dependencies: 0

## Ready Now

| ID | Task | Owner/Agent | Why Ready | Next Output |
|----|------|-------------|-----------|-------------|
| T10 | Run integration QA and create example templates | QA/release agent | T3, T4, T5, T6, T7, T8, T9, and T11 are implemented and ready for validation | Smoke checklist, sample inputs, and validated share flows |

## In Review

| ID | Task | Owner/Agent | Why In Review | Next Output |
|----|------|-------------|---------------|-------------|
| T3 | Implement local file ingestion and schema preview | Frontend data agent | Upload, normalization, and schema preview flow implemented and build-validated | Integration review and downstream adoption of the dataset contract |
| T4 | Define template contract and persisted template API model | Pipeline contract agent | Template schema, persisted DTOs, serialization helpers, and API client boundary are implemented and build-validated | Integration review and downstream adoption by T5, T8, and T11 |
| T5 | Implement transformation engine for Phase 1 operations | Data pipeline agent | Transform engine, calculated-field evaluator, test coverage, and build validation are complete | Integration review and downstream adoption by T6 and T7 |
| T6 | Build no-code transformation builder UI | Frontend workflow agent | Step editors, reorder/remove controls, live transform preview, and build validation are complete | Integration review and downstream adoption by T8 |
| T7 | Implement chart mapping and render layer | Visualization agent | Chart mapping controls, lightweight chart preview renderer, Vitest coverage, and build validation are complete | Integration review and downstream adoption by T8 |
| T8 | Implement persisted share/load/update/clone flow | Sharing agent | Public template route bootstrap, create/load/update/clone UX, share-link state, and build validation are complete | Integration review and QA reuse by T10 |
| T9 | Add thin backend service and deployment surface | Backend/platform agent | Health/info endpoints, Gradle build contract, env notes, and deploy notes are implemented | Verification of runtime/deploy behavior and reuse by T10 |
| T11 | Persist template configuration JSON in Postgres and expose public ULID routes | Backend persistence agent | Postgres-backed template persistence, ULID endpoints, docs, and tests are implemented | Verification by T8 and end-to-end reuse in T10 |

## Critical Path

`T4 -> T11 -> T8 -> T10`

`T3 -> T5 -> T6 -> T8 -> T10`

`T3 -> T7 -> T8 -> T10`

## Board

| ID | Status | Owner | Depends On | Summary |
|----|--------|-------|------------|---------|
| T1 | done | Product manager agent | none | Product brief, requirements, task board, and delegation briefs created |
| T2 | done | Platform agent | T1 | Frontend/backend starter repo created and documented |
| T3 | review | Frontend data agent | T1, T2 | Parse local CSV/JSON and normalize into one row model with schema preview |
| T4 | review | Pipeline contract agent | T1, T2 | Define template schema, persisted DTOs, and template API contract |
| T5 | review | Data pipeline agent | T3, T4 | Build transform engine for filter/group/aggregate/sort/calculated fields |
| T6 | review | Frontend workflow agent | T3, T4, T5 | Build no-code transform builder UI |
| T7 | review | Visualization agent | T3, T5 | Build chart mapping UI and preview layer |
| T8 | review | Sharing agent | T4, T6, T7, T11 | Build save/load/update/clone flow around persisted templates |
| T9 | review | Backend/platform agent | T2 | Harden Spring Boot backend boundary, Gradle build contract, env notes, and deploy surface |
| T10 | todo | QA/release agent | T3, T4, T5, T6, T7, T8, T9, T11 | Validate end-to-end happy path and example templates |
| T11 | review | Backend persistence agent | T2 | Persist template configuration JSON in Postgres with ULID-based public routes |

## Agent Lanes

- Frontend lane: `T3`, `T6`, `T7`, `T8`
- Pipeline/data lane: `T4`, `T5`
- Backend lane: `T9`, `T11`
- Release lane: `T10`

## Update Rules

When a task changes, update all three places together:

1. `TASKS.md`
2. `docs/task-registry.json`
3. `docs/agent-work-queue.md`

Minimum update fields:

- status
- status reason
- owner
- blockers or newly cleared dependencies
- next output or handoff target
