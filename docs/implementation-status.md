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
  - `apps/apple/HockeyTimer/HockeyTimerShared/MatchSyncModels.swift`
  - `apps/apple/HockeyTimer/HockeyTimerShared/MatchSyncViewModel.swift`
- iOS + watch simulator builds verified with `just` recipes.

## In Progress
- End-to-end product hardening and broader multi-device sync validation.

## Next Priorities
1. Replace hardcoded Apple API base URL with configurable runtime setting.
2. Implement durable local event queue on Apple clients (offline-first behavior).
3. Add KNHB integration in app flows (selection/prefill).
4. Start Android app scaffolding against same event/projection APIs.
5. Add integration tests for replay, dedupe, and event ordering edge cases.

