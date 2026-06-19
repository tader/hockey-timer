# Implementation Status

## Last Updated
2026-02-24

## Completed
- Initial docs-first architecture and planning set created.
- Event model decisions finalized (ordering, format-change behavior, sync transport, projection strategy, MVP scope).
- Web MVP flow implemented:
  - event upsert
  - projection polling
  - countdown + overtime display
  - end-period and end-match actions
  - match list sorting and filters (team/home/away/location/field/source)
  - custom match creation and quick-create flow
  - KNHB import for new match or assigning metadata to existing match
  - metadata editing, including `knhbMatchId` + `knhbSourceTeamId`
  - KNHB metadata refresh using `upcoming` + `official` match feeds
  - event stream table + scoreboard presentation mode
- Local events server implemented for MVP demo.
- Apple apps consolidated into one Xcode project:
  - `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS.xcodeproj`
- Shared Apple code extracted for iOS + watch:
  - `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncModels.swift`
  - `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift`
- iOS + watch simulator builds verified with `just` recipes.
- Apple API base URL is runtime configurable in iOS + watch settings.
- Apple shared sync now persists a durable offline event queue and retries flush on reconnect paths.
- iOS app includes KNHB club/team/upcoming-match browse + import flow for match prefill.
- iOS supports custom match creation and metadata editing.
- iOS match list now shows metadata, supports newest-first sorting, and filter inputs (home/away/club/team).
- Imported KNHB matches now persist `knhbMatchId` in local metadata.
- KNHB team picker now includes competition context in labels to disambiguate duplicate team names.
- KNHB logical team favorites implemented in web + iOS:
  - same-name teams per club (e.g. `Veld`/`Zaal`) grouped as one favorite
  - favorite label shown without type suffix
  - favorite loading merges matches from grouped team variants
- KNHB display/data rules documented:
  - club abbreviation preferred
  - team label `${name} (${type})`
  - match title `${home_team.name} – ${away_team.name}`
  - UTC source datetime displayed as local date in `Europe/Amsterdam`
- Unit tests added across core workspaces:
  - `shared/event-schema`: ordering + validation tests
  - `shared/replay-engine`: replay/projection behavior tests
  - `backend/services/events`: handler validation/dedup/list/projection tests
  - `apps/web`: KNHB parsing + metadata mapping tests
- Managed federated auth foundation implemented:
  - backend handlers and local server can require bearer tokens
  - OIDC/JWKS validation is configured by environment
  - CORS responses include authorization preflight support for hosted web sync
  - container health checks use unauthenticated `/health` so Traefik can route
    the authenticated API service
  - web app uses OIDC Authorization Code + PKCE sign-in and sends bearer tokens
  - iPhone app can use Auth0 Universal Login through native
    `ASWebAuthenticationSession` and mirrors access tokens to the watch
  - iPhone account sign-in controls are visible from the match list and detail
    views
  - hosted API exposes an authenticated match catalog derived from match
    metadata events, and iPhone merges it into the local match list
  - iPhone match list supports pull-to-refresh and publishes phone-created
    match metadata so the web app can discover those matches
  - Apple match sync attaches stored bearer auth and mirrors auth state from
    iPhone to watch through Watch Connectivity
- KNHB parsing hardened in web import flow:
  - dedicated parser module with guards against timestamp-like team fields
  - away-team timestamp regression covered by unit tests
- KNHB proxy now detects HockeyWeerelt self-redirect loops and returns a clear
  upstream error instead of a generic fetch failure.
- KNHB public match-center upstream moved to `https://app.hockeyweerelt.nl` and
  requires anonymous device registration plus `X-HAPI-*` signed request headers.

## In Progress
- End-to-end product hardening and broader multi-device sync validation.
- Android delivery is intentionally paused while Apple stack is finalized.
- Delivery rule active: implement new features in web first, then iOS/watch with parity.

## Recent Bug Findings
- Web match-view primary clock control could appear stale (for example showing `Start` while clock was running).
- Root cause: `refreshProjection()` updated live clock/score via `syncLivePanel()`, but button label/class/action visibility were previously only computed during full `render()`.
- Fix: sync logic now updates primary clock button (`Start`/`Pause`/`Resume`) and paused-only `End Match` visibility directly from the latest replayed state.
- KNHB proxy returned 502 for club browse because the old
  `publicaties.hockeyweerelt.nl/mc` API now self-redirects and the public
  match-center uses `app.hockeyweerelt.nl` with anonymous device registration
  plus signed HAPI headers.
- Fix: backend KNHB proxy now registers a server-side anonymous device, signs
  upstream requests with `X-HAPI-*` headers, and retries once on upstream 401.

## Next Priorities
1. Keep web app as feature reference and close parity gaps in iOS/watch immediately after web changes.
2. Expand integration tests (cross-workspace end-to-end) on top of current unit coverage.
3. Implement cloud/serverless persistence for events/projections beyond local demo server.
4. Extend Apple gossip sync behavior and diagnostics for poor connectivity.
5. Prepare Android backlog but keep implementation paused until Apple acceptance.
