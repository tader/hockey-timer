# Architecture Overview (Draft)

## High-Level Components
- Native clients:
  - watchOS app (SwiftUI)
  - iOS/iPadOS app (SwiftUI)
  - Android app (Kotlin + Jetpack Compose)
  - Wear OS app (Kotlin + Compose for Wear)
  - Web app (framework TBD)
- Serverless backend (AWS):
  - API Gateway
  - Lambda services
  - DynamoDB (event store + projections)
  - Cognito (candidate for auth)
  - CloudWatch/X-Ray for observability

## Data Layer (Proposed)
- `MatchEvents` table:
  - PK: `matchId`
  - SK: event ordering key
  - GSI for `eventId` uniqueness/idempotency checks
- `MatchProjection` table:
  - Current derived match state for fast read clients
- `SyncCheckpoint` table:
  - Per-client/per-match checkpointing
- `MatchMembers` table:
  - Match membership and role (`RW`/`RO`) per user/device identity
- `IdentityLink` table:
  - Anonymous identity to authenticated account merge mappings

## API Surface (Draft)
- `POST /matches/{id}/events:batchUpsert`
- `GET /matches/{id}/events?since=checkpoint`
- `GET /matches/{id}/projection`
- `POST /matches`
- `POST /matches/{id}/join`
- `POST /matches/{id}/members/{memberId}/role`
- `POST /identity/merge`
- `GET /clubs|teams|matches` proxy/cache APIs for KNHB data

## Client Architecture Principles
- Shared domain concepts but platform-native UI and lifecycle handling.
- Local persistence first, network second.
- Sync engine and replay engine are first-class components.
- Deterministic projection logic should be cross-validated across platforms.

## Reliability Considerations
- Idempotent writes end-to-end.
- Retry-safe network contracts.
- Queueing/backpressure when connectivity is weak.
- Telemetry around sync lag, conflict rates, and replay failures.

## Security & Privacy (Initial)
- Anonymous-first usage; sign-in is optional.
- AuthN/AuthZ required for shared match ownership and role-controlled writes.
- Public match/session read and `RO` join are default behavior in MVP.
- Encrypt in transit and at rest.
- Avoid storing sensitive personal data unless explicitly needed.

## Open Architecture Decisions
1. Single shared backend for all clients vs phased rollout by platform.
2. Multi-tenant data model and access boundaries.
3. Location-assisted join implementation and privacy controls.

## Realtime Strategy (Decided for MVP)
- Use polling-based update retrieval for MVP clients.
- Revisit push channels (WebSocket/AppSync) after MVP stabilization.

## Projection Strategy (Decided)
- Hybrid projection generation:
  - Synchronous lightweight projection update on successful event write.
  - Asynchronous projection rebuild/repair path for drift recovery and resilience.
