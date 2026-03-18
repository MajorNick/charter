# Backend

The backend is intentionally thin in the Charter MVP and is implemented with Spring Boot.

Current responsibilities:

- `/health` compatibility endpoint for a simple runtime check
- `/api/meta` metadata contract for the frontend and operators
- `/api/templates` create/load/update endpoints for persisted template JSON
- `/actuator/health`, `/actuator/health/liveness`, and `/actuator/health/readiness` for deployment probes
- `/actuator/info` for deploy metadata
- deployment scaffold for a Java service

Current non-responsibilities:

- source-data upload or storage
- server-side transformation execution
- auth or per-user access control
- dashboards, collaboration, or revision history

## Run

Requirements:

- Java 17+
- Gradle 9+
- Postgres 14+

Commands:

- `gradle -p backend bootRun`
- `gradle -p backend test`
- `gradle -p backend build`

The backend reads environment variables from the shell or deployment platform. It does not auto-load the root `.env.example`.

## Environment Contract

Documented in the root `.env.example`:

- `PORT`: HTTP port for the Spring Boot server. Defaults to `4000`.
- `APP_DEPLOY_ENV`: environment label returned by `/health`, `/api/meta`, and `/actuator/info`.
- `APP_VERSION`: deploy version surfaced in metadata endpoints.
- `APP_COMMIT_SHA`: commit identifier surfaced in metadata endpoints.
- `CORS_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call `/health` and `/api/**`.
- `SPRING_DATASOURCE_URL`: Postgres JDBC URL for template persistence.
- `SPRING_DATASOURCE_USERNAME`: Postgres username.
- `SPRING_DATASOURCE_PASSWORD`: Postgres password.

## Template API

Request shape for create and update:

```json
{
  "name": "Revenue by Segment",
  "description": "Quarterly revenue template",
  "config": {
    "schemaVersion": 1,
    "source": { "kind": "csv", "fields": [] },
    "transforms": [],
    "chart": {
      "chartType": "bar",
      "xField": "region",
      "yField": "revenue",
      "seriesField": null,
      "colorField": null
    }
  }
}
```

Response envelope for create, load, and update:

```json
{
  "template": {
    "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "name": "Revenue by Segment",
    "description": "Quarterly revenue template",
    "config": { "schemaVersion": 1 },
    "createdAt": "2026-03-17T12:00:00Z",
    "updatedAt": "2026-03-17T12:00:00Z"
  }
}
```

Endpoints:

- `POST /api/templates`: create a new persisted template and return its ULID.
- `GET /api/templates/{id}`: load a template by ULID.
- `PUT /api/templates/{id}`: update an existing template while keeping the same ULID.

## Deployment Notes

- Keep the backend narrow outside template persistence and platform readiness.
- Point platform liveness probes at `/actuator/health/liveness`.
- Point platform readiness probes at `/actuator/health/readiness` so database availability participates in readiness.
- Use `/api/meta` when the frontend or operators need an explicit statement of backend capabilities.
- Restrict `CORS_ALLOWED_ORIGINS` to the deployed frontend origin list.
- Run Flyway migrations as part of application startup against Postgres.


