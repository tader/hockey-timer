# Backend Services (MVP Scaffold)

Implemented:
- Event ingestion handler skeleton (`batchUpsert`).
- Event listing handler (`since` polling checkpoint pattern).
- Projection handler (replay-based).
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
