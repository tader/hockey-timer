# Task List

## Completed So Far
1. Planning decisions D-001 through D-011 captured in `docs/decision-log.md`.
2. Web MVP event/projection interaction implemented.
3. Local events service and polling endpoints implemented for demo.
4. Apple code consolidated to single project under `apps/apple/HockeyTimer/`.
5. Shared Apple sync/model code extracted to `HockeyTimerShared`.
6. Simulator builds validated with `just build-all-sim`.
7. Apple API base URL made runtime-configurable (iOS + watch).
8. Durable Apple offline event queue implemented.
9. iOS KNHB browse/import flow added for match prefill.

## Phase 0: Planning (Current)
1. Finalize product requirements document.
2. Decide sync ordering and conflict strategy.
3. Finalize event schema v1 and replay invariants.
4. Finalize architecture decisions for serverless backend.
5. Define MVP scope (Apple Watch + iPhone + web + backend).
6. Approve implementation plan and milestone breakdown.
7. Finalize anonymous-first identity merge flow.
8. Finalize collaboration permissions model and session visibility defaults.

## Phase 1: Foundations
1. Create repo structure for clients and backend packages.
2. Implement shared event schema definitions and validation contracts.
3. Build replay/projection reference implementation and test corpus.
4. Stand up AWS infrastructure (API Gateway, Lambda, DynamoDB).
5. Implement event ingestion and hybrid projection APIs with idempotency.
6. Define and test gossip replication protocol with UUID dedupe rules.
7. Implement identity model (anonymous + authenticated) and merge APIs.
8. Implement match membership roles (`RW`/`RO`) and authorization checks.
9. Implement join flows (public `RO` join + code/link + optional location-assisted discovery backend support).
10. Implement polling sync endpoints and client poll loop contracts.

## Phase 2: MVP Apps (Apple + Web)
1. Build watchOS timer UX for match control and scoring.
2. Build iOS companion with richer match management.
3. Implement gossip sync with preferred path watch↔phone, then phone↔cloud.
4. Add offline queueing/retry and convergence diagnostics.
5. Build web UI for match setup, live control, and history.
6. Connect web app to cloud event/projection APIs.
7. Add KNHB browse/select flow with cached backend integration.
8. Add user join UX and permission management UX (RO default, RW promotion).
9. Add optional sign-in UX with post-sign-in merge flow.
10. End-to-end test in poor connectivity scenarios.

## Phase 3: Android
Status: On hold until Apple apps are satisfactory.
1. Build Android phone app (Compose).
2. Build Wear OS app and local sync path.
3. Validate cross-platform convergence with shared test fixtures.

## Phase 4: Hardening
1. Add telemetry/alerts for sync lag and replay errors.
2. Load-test event ingestion and projection rebuild.
3. Security review and privacy/data-retention policy.
4. Beta rollout and feedback-driven iteration.

## Exit Criteria for Planning Phase
- Sync strategy approved.
- Event schema v1 approved.
- MVP boundaries approved.
- Milestones accepted.
