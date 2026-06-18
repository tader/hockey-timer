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
10. Watch admin tab overflow fixed: manual-app-inspired controls exceeded small
    watch heights because the tab used a fixed vertical stack. Admin controls now
    live inside a scroll container so API settings remains reachable.
11. Watch ended-match restart added: ended matches now offer quick creation of a
    fresh watch match with prominent `4 x 17½` format and alternate format
    choices.
12. Watch offline operation requirement tightened: live watch timing and score
    must use local projection first, with sync as background convergence only.
13. Apple API configuration ownership clarified: iPhone is primary; watch manual
    API editing is removed from watch UI.
14. Apple Justfile device install and paired simulator launcher commands added.
15. `just sim` launch gap fixed: original target booted the simulator pair only,
    so neither app was installed or launched on the iPhone/watch simulators.
16. Production Docker Compose entrypoint added for API and web frontend.
17. API persistence target selected: SQLite for development, PostgreSQL for
    production Compose hosting.
18. Physical Apple device IDs moved out of `Justfile` into environment/.env
    configuration.
19. Web frontend API base URL made runtime-configurable for production hosting.
20. Web runtime API config load order fixed: Vite moved module scripts ahead of
    body scripts, so `/config.js` must be in the document head before the app
    bundle.
21. Apple SwiftUI static previews added for all nine iOS/watchOS views. Preview
    fixtures use deterministic mock data, and preview models suppress network,
    polling side effects, event persistence, and store reads/writes.
22. Watch tab order and API endpoint ownership updated: watch pages now read
    left-to-right as Admin, Time, Score; timer score controls use larger rounded
    tinted buttons sized for two-digit scores; iPhone is the single API endpoint
    configuration point and mirrors that value to watchOS.
23. Authentication direction clarified: every native app remains usable locally
    without API configuration or sign-in; hosted API and web app usage require
    managed federated sign-in; iPhone owns Apple Watch sign-in and mirrors
    authenticated sync state to the paired watch.
24. Time tab cleanup completed: actions duplicated by Admin were removed except
    the start-period button, pending sync state moved to Admin, and freed space
    is used for larger timer text and larger score buttons.
25. Managed federated auth foundation implemented: backend/API can require
    bearer tokens, web app has OIDC PKCE sign-in and attaches tokens to API
    calls, and Apple sync attaches/mirrors auth state to watch while preserving
    local-only operation.
26. iPhone account controls added: visible Apple, Google, and GitHub sign-in
    entry points plus sign-out/status controls. Provider-specific native sign-in
    wiring remains behind managed auth configuration.
27. Web account controls added: explicit Apple, Google, and GitHub sign-in
    buttons route through configured OIDC PKCE login.

## Phase 0: Planning (Current)
1. Finalize product requirements document.
2. Decide sync ordering and conflict strategy.
3. Finalize event schema v1 and replay invariants.
4. Finalize architecture decisions for serverless backend.
5. Define MVP scope (Apple Watch + iPhone + web + backend).
6. Approve implementation plan and milestone breakdown.
7. Finalize anonymous-to-account identity merge flow for managed federated auth.
8. Finalize collaboration permissions model and session visibility defaults.

## Phase 1: Foundations
1. Create repo structure for clients and backend packages.
2. Implement shared event schema definitions and validation contracts.
3. Build replay/projection reference implementation and test corpus.
4. Stand up AWS infrastructure (API Gateway, Lambda, DynamoDB).
5. Implement event ingestion and hybrid projection APIs with idempotency.
6. Define and test gossip replication protocol with UUID dedupe rules.
7. Implement identity model (anonymous + managed federated account) and merge
   APIs.
8. Implement match membership roles (`RW`/`RO`) and authorization checks.
9. Implement join flows (public `RO` join + code/link + optional location-assisted discovery backend support).
10. Implement polling sync endpoints and client poll loop contracts.

## Phase 2: MVP Apps (Apple + Web)
1. Build web UI for match setup, live control, and history.
2. Connect web app to cloud event/projection APIs.
3. Implement each new feature in web first; treat web as reference behavior.
4. Port each feature to iOS companion app with parity.
5. Port each feature to watchOS app with parity.
6. Implement gossip sync with preferred path watch↔phone, then phone↔cloud.
7. Add offline queueing/retry and convergence diagnostics.
8. Add KNHB browse/select flow with cached backend integration.
9. Add user join UX and permission management UX (RO default, RW promotion).
10. Add managed federated sign-in UX with post-sign-in merge flow.
11. Add iPhone-to-watch authenticated sync-state handoff and sign-out revocation.
12. End-to-end test in poor connectivity scenarios.

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
