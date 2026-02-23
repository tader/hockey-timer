# Implementation Status

## Last Updated
2026-02-23

## Completed
- Initial docs-first architecture and planning set created.
- Event model decisions finalized (ordering, format-change behavior, sync transport, projection strategy, MVP scope).
- Web MVP flow implemented:
  - event upsert
  - projection polling
  - countdown + overtime display
  - end-period and end-match actions
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

## In Progress
- End-to-end product hardening and broader multi-device sync validation.
- Android delivery is intentionally paused while Apple stack is finalized.
- Delivery rule active: implement new features in web first, then iOS/watch with parity.

## Next Priorities
1. Keep web app as feature reference and close parity gaps in iOS/watch immediately after web changes.
2. Add integration tests for replay, dedupe, and event ordering edge cases.
3. Implement cloud/serverless persistence for events/projections beyond local demo server.
4. Extend Apple gossip sync behavior and diagnostics for poor connectivity.
5. Prepare Android backlog but keep implementation paused until Apple acceptance.
