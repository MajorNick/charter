# Charter

Charter is a web-based, low-code builder for turning raw CSV or JSON data into reusable chart templates.

The Phase 1 MVP is persistence-backed but still keeps uploaded source data client-side:

- users define data shape and transformation rules in the browser
- transformation logic runs client-side
- template configuration JSON is stored in the Spring Boot backend
- saved templates are shared through frontend routes shaped like `/t/<ulid>`
- recipients load the same template logic and upload their own local file

## Repo Layout

- `TASKS.md`: quick human-readable task board and current statuses
- `docs/charter-mvp-plan.md`: source-of-truth product brief, task board, and delegation briefs
- `docs/task-registry.json`: machine-readable task registry for status tracking
- `docs/agent-work-queue.md`: agent pickup order and ready-now briefs
- `docs/new-agent-quickstart.md`: minimal onboarding for newly assigned agents
- `frontend/`: primary MVP web app
- `backend/`: Spring Boot service for template persistence, health checks, and future expansion

## Working Assumptions

- Frontend-first MVP built with React + TypeScript
- Backend uses Spring Boot + Postgres for template persistence
- Uploaded source data stays client-side in Phase 1
- Initial charts are bar, line, and pie
- Phase 1 JSON support is limited to flat arrays of objects
- Initial transforms are filter, group, aggregate, sort, and simple calculated fields on flat tabular data

## Local Start

Prerequisites:

- Node.js for the frontend
- Java 17+, Gradle 9+, and Postgres 14+ for the backend

1. Install frontend workspace dependencies with `npm install`.
2. Start Postgres and set the backend env vars from `.env.example`.
3. Run the frontend with `npm run dev:frontend`.
4. Run the Spring Boot backend with `npm run dev:backend`.

The frontend is still the main delivery surface for the MVP. The backend now owns template persistence plus a thin operational surface.

## Backend Contract

The backend remains intentionally narrow for the MVP:

- `GET /health` provides a lightweight runtime check.
- `GET /api/meta` declares the backend mode and capabilities.
- `POST /api/templates`, `GET /api/templates/{id}`, and `PUT /api/templates/{id}` manage persisted template configuration JSON.
- Template endpoints return a `{ "template": ... }` envelope that matches the frontend contract.
- `GET /actuator/health`, `GET /actuator/health/liveness`, `GET /actuator/health/readiness`, and `GET /actuator/info` support deployment checks and release metadata.

Uploaded data storage and server-side transformation processing remain out of scope for Phase 1.


