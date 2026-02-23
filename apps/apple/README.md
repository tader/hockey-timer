# Apple Apps

Single consolidated Apple Xcode project:
- `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS.xcodeproj`

Targets:
- `HockeyTimerIOS` (iPhone companion app)
- `HockeyTimerWatch Watch App` (watch companion app)

Shared Apple code (used by both targets):
- `apps/apple/HockeyTimer/HockeyTimerShared/MatchSyncModels.swift`
- `apps/apple/HockeyTimer/HockeyTimerShared/MatchSyncViewModel.swift`

Target-specific wrappers:
- `apps/apple/HockeyTimer/HockeyTimerIOS/IOSMatchViewModel.swift`
- `apps/apple/HockeyTimer/HockeyTimerWatch Watch App/WatchMatchViewModel.swift`

Build with Just:
- `just build-ios-sim`
- `just build-watch-sim`
- `just build-all-sim`
