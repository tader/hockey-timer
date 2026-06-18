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
  - Managed federated identity broker for auth (for example Cognito federation,
    Auth0, Clerk, or another OIDC/OAuth-compatible service)
  - CloudWatch/X-Ray for observability

## Data Layer (Proposed)
- Local/demo API persistence:
  - SQLite is the default store for developer runs.
  - Default file path: `data/hockey-timer.sqlite`.
  - Containerized SQLite runs should mount `/data` and set
    `SQLITE_PATH=/data/hockey-timer.sqlite`.
- Production Compose persistence:
  - PostgreSQL service `db`.
  - API uses `STORAGE_DRIVER=postgres` and `DATABASE_URL`.
  - Event idempotency is enforced by a primary key on `eventId`.
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

## Authentication Model (Draft)
- Local native app usage does not require sign-in or API configuration. Clients
  create local anonymous identities and local event queues immediately.
- Hosted API calls require bearer tokens from the managed identity broker. The
  backend validates token issuer/audience and maps the authenticated subject to
  an internal account id.
- Web app usage requires sign-in before reading or mutating account-scoped match
  data.
- Native clients may remain local-only indefinitely. When a signed-in account is
  available, clients upload queued local events through the authenticated API and
  run identity merge for anonymous-created matches.
- Account-owned matches are queryable from any signed-in surface. Match events
  retain immutable origin metadata while ownership/membership records attach the
  match to the authenticated account.
- Apple Watch does not present provider sign-in UI. The iPhone app owns sign-in
  and mirrors authenticated sync state to the paired watch through Watch
  Connectivity. The mirrored watch credential/session must be revocable from the
  phone and scoped to API sync only.
- If watch auth state is absent or expired, watch remains usable locally and
  queues sync until a valid phone-mediated authenticated session is available.

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
- Anonymous-first local usage; sign-in is optional unless using hosted API sync
  or web.
- AuthN/AuthZ required for hosted API access, shared match ownership, and
  role-controlled writes.
- No first-party password storage or password reset flow. Use federated
  providers through a managed identity broker.
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
