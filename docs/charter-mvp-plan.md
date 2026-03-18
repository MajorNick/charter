## Project Brief

- Goal: Build Charter as a browser-first low-code pipeline builder for turning local CSV or JSON data into shareable chart templates.
- Users / Audience: Analysts, operators, product managers, consultants, and internal teams who need repeatable chart logic without writing code.
- Problem: Reusable data-to-chart workflows are usually trapped in scripts, spreadsheets, or heavy BI tools, which makes them hard to share with non-technical users.
- Proposed Solution: A step-based web app where users define an input shape, compose transformation rules through forms, map the result to a chart, and save the template configuration JSON in the backend. Each template gets a ULID and is shared through a public URL shaped like `/t/<ulid>`.
- Scope: CSV and JSON upload, schema preview, linear transformation pipeline, chart mapping for a small chart set, Spring Boot + Postgres template persistence, public link-based template loading, template update, and template clone.
- Non-goals: Auth, multi-user collaboration, source-data upload/storage in the backend, external data connectors, arbitrary code execution, joins across files, or a full BI/dashboard platform.
- Success Criteria: A user can build a template, save it, and share a `/t/<ulid>` link; a second user can open the link, upload their own compatible file, and see the chart render with no manual reconfiguration.

## Requirements

- Functional:
  - Parse local CSV and JSON files in the browser.
  - Normalize uploaded data into a consistent tabular model for downstream steps.
  - Preview inferred schema and sample rows before transformations are applied.
  - Support a linear sequence of transformations with no-code controls.
  - Support Phase 1 transformations: filter, group by, aggregate, sort, simple calculated fields, and rename/select fields where needed for chart mapping.
  - Support Phase 1 chart types: bar, line, and pie.
  - Map transformed data fields to chart inputs such as label, x-axis, y-axis, series, and color.
  - Persist template configuration JSON in the backend.
  - Generate a unique ULID for each new template.
  - Load template configuration by ULID.
  - Update an existing template while keeping the same ULID.
  - Clone an existing template into a new template with a new ULID.
  - Let a recipient upload a local file and render the chart against the shared template.
- Non-functional:
  - Uploaded source data remains client-side only in Phase 1.
  - Public read-by-link is allowed in Phase 1.
  - Deterministic transformations for the same input and template.
  - Fast enough for small-to-medium local files used in ad hoc reporting.
  - Clear validation and error messaging when a template and uploaded file are incompatible.
  - Mobile-safe layout for browsing and simple edits, with desktop optimized for full template authoring.
- Constraints:
  - Backend stores template configuration JSON only; source data is not persisted in MVP.
  - Transformation execution happens client-side.
  - Template persistence uses Spring Boot + Postgres.
  - Public template URLs use `/t/<ulid>`.
  - Backend scope should stay intentionally narrow outside template persistence and platform readiness.
- Acceptance Criteria:
  - A first-time user can author a template from a sample file in one sitting.
  - Saving a template returns a stable ULID-backed link.
  - Shared links restore the full template logic on load.
  - Updating a template keeps the same ULID.
  - Cloning a template creates a new ULID.
  - The receiving user is prompted only for their own data file, not for missing template decisions.
  - Unsupported files or schema mismatches produce actionable errors instead of silent failures.

## Architecture Summary

- Frontend:
  - Owns the builder workflow, file parsing, data normalization, transformation execution, chart rendering, and user flows for save, update, load, and clone.
  - Maintains a typed template definition that can be persisted as backend-stored JSON.
  - Treats the dataset as ephemeral runtime state, never part of the shared backend payload.
  - Owns frontend routing for public template links such as `/t/<ulid>`.
- Backend:
  - Uses Spring Boot + Postgres.
  - Owns template persistence, ULID generation, and public create/read/update/clone APIs for template configuration JSON.
  - Also owns health, info, deployment probes, and environment configuration.
- Domain model:
  - `sourceDefinition` -> `normalizedDataset` -> `transformationSteps[]` -> `chartMapping` -> `templateConfig`
  - persisted template record: `id (ULID)` + `templateConfigJson` + `createdAt` + `updatedAt` + optional metadata fields
  - Phase 1 keeps the pipeline linear instead of introducing a graph or branching model.

## Assumptions and Open Questions

- Assumptions:
  - React + TypeScript is the fastest frontend base for the MVP.
  - JSON support in Phase 1 targets flat array-of-object payloads only.
  - File sizes stay modest enough for client-side parsing and transformation.
  - A lightweight transformation engine is sufficient; full SQL emulation is out of scope.
  - The backend uses Spring Boot + Postgres for template persistence.
  - Uploaded source data remains client-side only.
  - Public read-by-link is acceptable for Phase 1.
  - Updating a template keeps the same ULID; clone creates a new template with a new ULID.
- Open Questions:
  - Should templates include title and description fields in MVP or only raw configuration JSON?
  - Should Phase 1 include template delete, or can we defer that until auth exists?
  - Should Phase 1 keep revision history, or is last-write-wins enough?
  - How opinionated should the app be about schema mismatches when a recipient uploads a different file?
- Decisions Needed:
  - Choose the charting library.
  - Define the safe first-version formula grammar for calculated fields.
  - Choose whether the transform engine is custom or backed by a browser-friendly data library.
  - Choose the Spring Boot persistence stack details for T11: JDBC/JPA, migration tool, and JSON column strategy.

## Execution Plan

1. Milestone: Foundation And Contracts
   - Outcome: Starter repo, documented MVP scope, typed template contract, persisted template API contract, and clear task ownership.
   - Why now: Every downstream agent depends on stable boundaries for data, transforms, persistence, and rendering.
   - Exit criteria: Repo skeleton exists and agent work can begin from the documented task board.
2. Milestone: Data And Pipeline Engine
   - Outcome: Users can upload a file, inspect normalized data, and apply supported transformations.
   - Why now: The pipeline engine is the product core and blocks both builder UI and chart output.
   - Exit criteria: Filter, group, aggregate, sort, and simple calculated fields work against normalized data with test coverage.
3. Milestone: Builder And Visualization
   - Outcome: Users can build transformations through the UI and map results onto supported charts.
   - Why now: This converts the underlying data engine into the no-code product experience.
   - Exit criteria: End-to-end authoring works from file upload through live chart preview.
4. Milestone: Persistence, Sharing, And Hardening
   - Outcome: Templates can be saved in the backend, shared through `/t/<ulid>`, updated in place, and cloned into new templates.
   - Why now: Shareability is still the differentiator, but it now depends on persistence rather than URL encoding.
   - Exit criteria: Save/update/clone/load flows, mismatch handling, docs, and smoke validation are complete.

## Task Board

| ID | Task | Owner/Agent | Status | Prerequisites | Dependencies | Output | Done When |
|----|------|-------------|--------|---------------|--------------|--------|-----------|
| T1 | Convert product brief into repo-ready scope, architecture, and task board | Product manager agent | done | Project description received | none | `docs/charter-mvp-plan.md` | Scope, risks, and delegation briefs are committed and usable by other agents |
| T2 | Bootstrap monorepo starter with `frontend` and `backend` directories | Platform agent | done | T1 | T1 | Root workspace config and app scaffolds | New contributors can identify where frontend and backend work belongs immediately |
| T3 | Implement local file ingestion and schema preview | Frontend data agent | review | T1, T2 | T1, T2 | Upload flow, parser adapters, schema preview state | CSV and JSON files can be loaded and normalized into a consistent row model |
| T4 | Define template contract and persisted template API model | Pipeline contract agent | review | T1, T2 | T1, T2 | Typed template schema, persisted DTOs, and API contract utilities | Builder state can be saved as template JSON and loaded by ULID without raw input data |
| T5 | Implement transformation engine for Phase 1 operations | Data pipeline agent | review | T3, T4 | T3, T4 | Execution layer and unit tests for filter/group/aggregate/sort/calculated fields | Supported steps run deterministically on normalized datasets |
| T6 | Build no-code transformation builder UI | Frontend workflow agent | review | T3, T4, T5 | T3, T4, T5 | Multi-step builder screens and validation states | Users can configure supported transformations, including calculated fields, without writing code |
| T7 | Implement chart mapping and render layer | Visualization agent | todo | T3, T5 | T3, T5 | Chart configuration UI and preview renderer | Bar, line, and pie charts render from transformed output |
| T8 | Implement persisted share/load/update/clone flow | Sharing agent | blocked | T4, T6, T7, T11 | T4, T6, T7, T11 | Save panel, load bootstrap, clone action, mismatch handling | Public links load backend-stored templates, updates keep the same id, and clone creates a new ULID |
| T9 | Add thin backend service and deployment surface | Backend/platform agent | review | T2 | T2 | Spring Boot health route, metadata route, Gradle build contract, env contract, deploy notes | Backend can run and deploy cleanly with Gradle without implying source-data storage or server-side processing |
| T10 | Run integration QA and create example templates | QA/release agent | blocked | T3, T4, T5, T6, T7, T8, T9, T11 | T3, T4, T5, T6, T7, T8, T9, T11 | Smoke checklist, sample inputs, and validated share links | Happy-path authoring, save/update/clone, and template reuse are confirmed end to end |
| T11 | Persist template configuration JSON in Postgres and expose public ULID routes | Backend persistence agent | review | T2 | T2 | Postgres schema, ULID generation, create/read/update/clone endpoints | Template config JSON is stored in Postgres, public read by ULID works, updates keep the same id, and clone creates a new ULID |

## Risks and Dependencies

- Risk:
  - Impact: Public template links expose configuration to anyone who has the URL.
  - Mitigation: Keep source data client-side, keep Phase 1 read-only by link, and plan auth or scoped permissions for later phases.

- Risk:
  - Impact: Persisted template schema changes may break older templates once stored records accumulate.
  - Mitigation: Version the template config schema early and validate compatibility at load time.

- Risk:
  - Impact: Postgres and backend availability are now on the share-flow critical path.
  - Mitigation: Keep the persistence model minimal, add health/readiness checks, and separate platform hardening (T9) from persistence work (T11).

- Risk:
  - Impact: Update-versus-clone semantics may confuse users and cause accidental overwrites.
  - Mitigation: Make save/update/clone actions explicit in the UI and validate them in QA.

- Risk:
  - Impact: CSV and JSON normalization may diverge enough that downstream transforms become inconsistent.
  - Mitigation: Force both parsers into a single normalized row-and-field contract before builder work starts.

- External Dependency:
  - Needed For: Picking the charting and data processing libraries without unnecessary rewrites.
  - Fallback: Start with typed interfaces and thin adapters so underlying libraries can be swapped later.

## Next Recommended Action

- Immediate next step: Assign T7, and review/accept T3, T4, T5, T6, T9, and T11.
- Who should do it: One visualization agent for chart mapping and preview, plus a reviewer for the current frontend/backend contract work.
- What input is still needed: Confirm the charting library, the safe first-version calculated-field grammar, and whether template title/description should be first-class MVP fields.

## Delegation Briefs

### T3

- Suggested agent: Frontend data agent
- Objective: Build the local file ingestion layer and schema preview state for CSV and JSON uploads.
- Scope: `frontend` parsing utilities, upload flow state, normalization model, and preview-ready sample output.
- Prerequisites already met: Project brief, repo structure, MVP constraints, and task boundaries are documented.
- Blocking dependencies: T1, T2
- Expected output: A normalized dataset contract, parser adapters, and UI state hooks/components for previewing schema and sample rows.
- Done when: A local file can be parsed into a stable row model that downstream tasks can consume without format-specific branching.

### T4

- Suggested agent: Pipeline contract agent
- Objective: Define the template schema and persisted template API contract.
- Scope: Type definitions for source definition, transform steps, chart mapping, template config, persisted template DTOs, and client API helpers for create/update/load/clone.
- Prerequisites already met: Project brief, repo structure, MVP constraints, and task boundaries are documented.
- Blocking dependencies: T1, T2
- Expected output: Typed contract files, API shapes, and decisions on what is excluded from the persisted payload.
- Done when: Builder state can be saved as template JSON and loaded by ULID without including raw input data.

### T5

- Suggested agent: Data pipeline agent
- Objective: Implement the deterministic execution layer for Phase 1 transformations.
- Scope: Transformation evaluators for filter, group by, aggregate, sort, simple calculated fields, and any minimal field-selection helpers needed by chart mapping.
- Prerequisites already met: T1, T2
- Blocking dependencies: T3, T4
- Expected output: Transformation engine modules with unit tests and a clear contract from normalized input to transformed output.
- Done when: Supported operations can be composed in a linear pipeline and produce consistent results for the same input and template.

### T6

- Suggested agent: Frontend workflow agent
- Objective: Build the no-code transformation authoring UI around the pipeline contract and execution layer.
- Scope: Builder screens, step editors, validation states, and interactions for adding, editing, removing, and reordering transform steps.
- Prerequisites already met: T1, T2
- Blocking dependencies: T3, T4, T5
- Expected output: Frontend workflow that makes supported transformations discoverable and understandable without code.
- Done when: A user can author the Phase 1 transformation set entirely through form controls and see clear validation feedback.

### T7

- Suggested agent: Visualization agent
- Objective: Build chart mapping controls and live chart preview for the transformed dataset.
- Scope: Supported chart adapters, chart field mapping UI, preview states, and handling for incompatible mappings.
- Prerequisites already met: T1, T2
- Blocking dependencies: T3, T5
- Expected output: Chart renderer integration and mapping screens for bar, line, and pie charts.
- Done when: The transformed dataset can be previewed as a supported chart using an explicit field mapping contract.

### T8

- Suggested agent: Sharing agent
- Objective: Wire the save, load, update, and clone experience around the persisted template API.
- Scope: Frontend save/update actions, frontend route bootstrap for `/t/<ulid>`, clone button behavior, template compatibility checks, and UX for sharing public links.
- Prerequisites already met: T1, T2
- Blocking dependencies: T4, T6, T7, T11
- Expected output: Save/load/update/clone flows and user-facing handling for missing or incompatible uploaded files.
- Done when: A recipient can open a shared link, upload their own file, and reach the chart preview; updates keep the same ULID and clone produces a new one.

### T9

- Suggested agent: Backend/platform agent
- Objective: Keep a minimal but deployable Spring Boot backend surface ready for later phases.
- Scope: Spring Boot health route, metadata route, Gradle build contract, environment handling, and deployment-oriented documentation.
- Prerequisites already met: T1, T2
- Blocking dependencies: T2
- Expected output: Runnable Gradle-backed Spring Boot starter and a small contract describing what the backend currently does and does not own.
- Done when: The backend starts cleanly with Gradle, exposes health metadata, and does not imply source-data storage or server-side processing in the MVP.

### T10

- Suggested agent: QA/release agent
- Objective: Validate the entire Phase 1 flow and package handoff artifacts for continued development.
- Scope: Smoke tests, sample datasets, save/load/update/clone validation, and documentation updates tied to discovered gaps.
- Prerequisites already met: T1, T2
- Blocking dependencies: T3, T4, T5, T6, T7, T8, T9, T11
- Expected output: A release-readiness checklist with defects, confirmed flows, and representative examples.
- Done when: The happy path is verified end to end and remaining gaps are explicit enough to schedule rather than rediscover.

### T11

- Suggested agent: Backend persistence agent
- Objective: Implement Postgres-backed template persistence and public ULID routes.
- Scope: Postgres schema/migrations, ULID generation, repository/service boundary, and create/read/update/clone endpoints for template configuration JSON.
- Prerequisites already met: T1, T2
- Blocking dependencies: T2
- Expected output: A backend persistence layer and API contract that the frontend can call for save/load/update/clone flows.
- Done when: Template configuration JSON is stored in Postgres, public read by ULID works, updates keep the same id, and clone creates a new ULID without persisting raw source data.
