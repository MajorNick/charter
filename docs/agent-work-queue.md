# Charter Agent Work Queue

Updated: 2026-03-17

Use this file to assign work without reopening the full planning thread.

## Pickup Order

1. `T10` QA/release agent

## In Review

### T3

- Agent: Frontend data agent
- Status: `review`
- Goal: Parse local CSV/JSON uploads and normalize them into a single dataset model with schema preview.
- Scope: `frontend/src/**`
- Dependencies already satisfied: `T1`, `T2`
- Expected output: Parser adapters, normalization model, upload state, schema preview UI/state
- Status reason: Upload, normalization, and schema preview flow is implemented and frontend build validation passed.
- Next output: Integration review and downstream consumption of the normalized dataset contract.
- Done when: CSV and JSON files can be loaded and normalized into a consistent row model.

### T4

- Agent: Pipeline contract agent
- Status: `review`
- Goal: Define the template schema and persisted template API contract for backend-stored templates.
- Scope: `frontend/src/**`, shared frontend types, client API contract docs
- Dependencies already satisfied: `T1`, `T2`
- Expected output: Typed template schema, persisted template DTOs, create/update/load/clone contract
- Status reason: Template schema, persisted DTOs, serialization helpers, and API client boundary are implemented and frontend build validation passed.
- Next output: Integration review and downstream adoption by `T5`, `T8`, and `T11`.
- Done when: Builder state can be saved as template configuration JSON and loaded by ULID without embedding raw input data.

### T5

- Agent: Data pipeline agent
- Status: `review`
- Goal: Implement deterministic filter, group, aggregate, sort, and calculated-field execution.
- Scope: `frontend/src/**`
- Dependencies already satisfied: `T3`, `T4`
- Expected output: Execution layer and unit tests for filter, group, aggregate, sort, and calculated fields
- Status reason: Transform engine, calculated-field evaluator, Vitest coverage, and production build validation are complete.
- Next output: Integration review and downstream adoption by `T6` and `T7`.
- Done when: Supported steps run deterministically on normalized datasets.

### T6

- Agent: Frontend workflow agent
- Status: `review`
- Goal: Build the no-code transformation builder UI.
- Scope: `frontend/src/**`
- Dependencies already satisfied: `T3`, `T4`, `T5`
- Expected output: Builder screens, step editors, and validation states for no-code transforms
- Status reason: Step editors, reorder/remove controls, live transform preview, and frontend validation are complete.
- Next output: Integration review and downstream adoption by `T8`.
- Done when: Users can configure supported transformations, including calculated fields, without writing code.

### T7

- Agent: Visualization agent
- Status: `review`
- Goal: Build chart mapping controls and preview rendering.
- Scope: `frontend/src/**`
- Dependencies already satisfied: `T3`, `T5`
- Expected output: Chart configuration UI and preview renderer
- Status reason: Chart mapping controls, lightweight chart preview renderer, Vitest coverage, and frontend build validation are complete.
- Next output: Integration review and downstream adoption by `T8`.
- Done when: Bar, line, and pie charts render from transformed output.

### T8

- Agent: Sharing agent
- Status: `review`
- Goal: Build the persisted template save/load/update/clone experience.
- Scope: `frontend/src/**`
- Dependencies already satisfied: `T4`, `T6`, `T7`, `T11`
- Expected output: Save panel, load bootstrap, clone action, and mismatch handling
- Status reason: Public template route bootstrap, create/load/update/clone UX, share-link state, and frontend validation are complete.
- Next output: QA reuse and end-to-end validation in `T10`.
- Done when: Public links load backend-stored templates, updates keep the same id, and clone creates a new ULID.

### T9

- Agent: Backend/platform agent
- Status: `review`
- Goal: Harden the Spring Boot backend boundary and deployment contract without expanding MVP scope.
- Scope: `backend/**`, `README.md`, `.env.example`
- Dependencies already satisfied: `T2`
- Expected output: Stable Spring Boot health/meta surface, Gradle build contract, environment notes, deployment notes
- Status reason: Health and info endpoints, Gradle build contract, env contract notes, and deploy notes are implemented and ready for verification.
- Next output: Validation handoff into `T10`
- Done when: Backend can run and deploy cleanly with Gradle without implying source-data storage or server-side processing.

### T11

- Agent: Backend persistence agent
- Status: `review`
- Goal: Persist template configuration JSON in Postgres and expose public ULID-based template endpoints.
- Scope: `backend/**`, `.env.example`, backend persistence docs
- Dependencies already satisfied: `T2`
- Expected output: Postgres schema/migration strategy, ULID generation, create/read/update/clone endpoints
- Status reason: Template persistence layer, ULID endpoints, environment/docs updates, and backend tests are implemented and ready for verification.
- Next output: Reuse by `T8` and end-to-end validation in `T10`
- Done when: Template configuration JSON is stored in Postgres, public read by ULID works, updates keep the same id, and clone creates a new ULID.

## Ready Now

### T10

- Agent: QA/release agent
- Status: `todo`
- Goal: Validate the end-to-end flow and package sample templates.
- Scope: `frontend/**`, `backend/**`, `docs/**`
- Dependencies already satisfied: `T3`, `T4`, `T5`, `T6`, `T7`, `T8`, `T9`, `T11`
- Expected output: Smoke checklist, sample inputs, and validated save/load/update/clone flows
- Status reason: Frontend authoring, persistence, share flow, backend platform surface, and backend persistence path are implemented and ready for QA.
- Done when: Happy-path authoring, save/update/clone, and template reuse are confirmed end to end.

## Copy-Paste Assignment Template

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

Return:
- What changed
- Files changed
- Tests or validation run
- Open questions or blockers
```
