# Decision Log

Track decisions required before implementation. Use status:
- `open`
- `decided`
- `deferred`

## D-001: Event Ordering Canonicalization
- Status: `decided`
- Context: Multiple offline clients can emit concurrent events.
- Options:
  - Server timestamp first, then deterministic client tie-break.
  - Hybrid logical clocks.
  - Vector clocks + conflict resolution pass.
- Decision: Use trusted device `occurredAt` as canonical ordering time.
  Tie-break with `originDeviceId + sequence` when timestamps are equal.
  `recordedAt` remains for audit/observability, not primary ordering.

## D-002: Format Change Semantics Mid-Match
- Status: `decided`
- Context: Users must change match format after start.
- Options:
  - Apply immediately to current period.
  - Apply from next period boundary.
  - Prompt user to choose per change.
- Decision: Apply immediately to the current period.

## D-003: Watch-Phone Sync Transport
- Status: `decided`
- Context: Watch reliability is critical.
- Options:
  - Native watch connectivity APIs as primary path.
  - Cloud-first with local fallback.
  - Dual path with adaptive routing.
- Decision: Use gossip-style event exchange between peers, with UUID-based
  deduplication on every sync path. Preferred path is watch ↔ phone local sync,
  then phone ↔ cloud/web. If watch cannot reach phone, watch syncs directly with
  cloud/web when possible. If no path is available, queue locally and retry later.

## D-004: Projection Generation Strategy
- Status: `decided`
- Context: Need low-latency reads and rebuildability.
- Options:
  - Synchronous projection update on event write.
  - Async projection pipeline.
  - Hybrid.
- Decision: Hybrid. Perform a lightweight synchronous projection update on
  successful event write for low-latency reads, plus an asynchronous rebuild/
  repair pipeline to guarantee eventual projection correctness.

## D-005: MVP Scope Boundary
- Status: `decided`
- Context: Platform breadth is large.
- Options:
  - Apple Watch + iPhone + backend first.
  - Include web in MVP.
  - Include Android in MVP.
- Decision: Include web in MVP alongside Apple Watch, iPhone, and backend.
  Android phone and Wear OS remain post-MVP phases.

## D-006: Authentication and Authorization Approach
- Status: `decided`
- Context: Cross-platform clients and web need controlled access to matches and
  sync APIs.
- Options:
  - AWS Cognito user pools + JWT authorizer in API Gateway.
  - Third-party identity provider (OIDC) + federated backend auth.
  - Initial anonymous/local mode, then authenticated accounts.
- Decision: Anonymous-first mode is required. Users are not forced to sign in.
  If a user signs in later, local anonymous data must merge into the selected
  account without losing match history/events.

## D-007: Match Collaboration, Join, and Permissions
- Status: `decided`
- Context: Multiple referees and participants must access the same live match.
- Options:
  - Invite code/link only.
  - Location-assisted discovery only.
  - Hybrid join paths with role-based permissions.
- Decision: Hybrid join paths with role-based access:
  - Match creator is `RW` (owner).
  - New joiners are `RO` by default.
  - `RW` users can promote others to `RW`.
  - Location-assisted discovery is supported to make joining easier.

## D-008: MVP Conflict Handling Policy
- Status: `decided`
- Context: Concurrent edits can happen in weak connectivity scenarios.
- Options:
  - Automated conflict resolution workflows.
  - Minimal policy with manual post-hoc corrections.
- Decision: MVP will not implement advanced conflict resolution UX/workflows.
  If multiple users increment score concurrently, all events are preserved and
  users fix scoreboard state via explicit correction events afterward.

## D-009: Session Visibility and Join Defaults
- Status: `decided`
- Context: Match information is considered public in this product context.
- Options:
  - Private-by-default matches.
  - Public-by-default matches.
- Decision: Public by default. Users can join sessions as `RO` without sign-in.

## D-010: MVP Realtime Update Transport
- Status: `decided`
- Context: Need a concrete sync delivery mode for MVP implementation.
- Options:
  - WebSocket/AppSync push.
  - Polling.
  - Hybrid push + polling fallback.
- Decision: Polling for MVP (simple and robust). Re-evaluate push channels in
  a later phase without blocking core delivery.

## D-011: Timer Display and Period Control Behavior
- Status: `decided`
- Context: Referees need reliable match control under time pressure.
- Options:
  - Show elapsed time only.
  - Show remaining period time and overtime explicitly.
- Decision: Show remaining period time as countdown by default. After period
  time reaches zero, continue showing overtime as `+MM:SS over`. `End Period`
  must work even if timer was never started. `End Match` must always be available.

## D-012: Local and Production API Persistence
- Status: `decided`
- Context: The hosted API must survive container restarts, while development
  should remain simple and local.
- Options:
  - Keep in-memory storage for MVP demo only.
  - Use SQLite everywhere.
  - Use SQLite for development and PostgreSQL for production hosting.
- Decision: Use SQLite as the default development store and PostgreSQL for the
  production Compose stack. The API selects the store via `STORAGE_DRIVER`.
  SQLite uses `SQLITE_PATH`; production Compose runs a `db` container and points
  the API at it with `DATABASE_URL`.

## D-013: Apple API Endpoint Configuration Ownership
- Status: `decided`
- Context: Watch API editing is removed from watch UI, but the watch still needs
  the same backend endpoint as the iPhone.
- Options:
  - Keep separate iPhone and watch `UserDefaults` values.
  - Configure on iPhone only and mirror to watch with Watch Connectivity.
  - Configure in a shared cloud profile.
- Decision: Configure the API endpoint at one point in the iPhone app. The
  iPhone persists the value locally and mirrors it to the watch with Watch
  Connectivity application context/messages. The watch accepts the mirrored
  endpoint and uses it for sync without exposing endpoint editing UI.
