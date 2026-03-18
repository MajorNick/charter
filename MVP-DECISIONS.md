# Charter MVP Decisions

Updated: 2026-03-17

## Confirmed

- Template URLs use `/t/<ulid>`.
- Template read access is public in Phase 1.
- Backend stores template configuration JSON only.
- Uploaded source data remains client-side only.
- Updating a template keeps the same ULID.
- Clone creates a new template with a new ULID.
- Backend persistence uses Spring Boot + Postgres.
- Charts are rendered in the frontend. The charting library is still open.
- Phase 1 JSON support stays narrow: flat arrays of objects only.
- Calculated fields are included in the MVP.

## Practical Scope For Calculated Fields

Recommended first cut:

- arithmetic on numeric fields
- concatenation for labels
- simple conditional expressions

Defer for later:

- arbitrary code
- complex date functions
- nested formulas
- multi-step formula references

## Data Boundary

- Store template configuration JSON in the backend.
- Do not store uploaded source data in the backend for MVP.
- Keep transformation execution in the browser for MVP.

## Immediate Impact On Task Board

- T4 now defines the persisted template schema and API contract instead of URL-hash encoding.
- T8 now covers save, load, update, and clone UX around backend-backed templates.
- T9 remains the backend hardening task already in review.
- T11 covers Postgres persistence, ULID generation, and public template endpoints.
