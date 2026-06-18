# Backend Services (MVP Scaffold)

Implemented:
- Event ingestion handler skeleton (`batchUpsert`).
- Event listing handler (`since` polling checkpoint pattern).
- Projection handler (replay-based).
- Optional hosted API authentication gate:
  - `AUTH_MODE=required` makes API routes require `Authorization: Bearer ...`.
  - `AUTH_JWKS_URL`, `AUTH_ISSUER`, and `AUTH_AUDIENCE` configure managed OIDC
    JWT validation.
  - `AUTH_DEV_BEARER_TOKEN` is for local/dev tests only.
- In-memory store placeholder to validate API behavior before Dynamo wiring.

Primary code:
- `backend/services/events/src/handlers.ts`
- `backend/services/events/src/store.ts`

Local runnable server:
- `backend/services/events/local-server.mjs`

Run:
```sh
npm run start:events
```
