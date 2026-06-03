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

Install on paired physical devices with Just:
- `just install phone` installs the iPhone app on `1141CA4B-F44F-55A6-967A-E61ECA88B38E`.
- `just install watch` installs the watch app on `25CED29A-60BD-5609-BA9F-21EA516A4291`.
- `just install` installs both apps.

Simulator:
- `just sim` boots the paired iPhone 17 Pro + Apple Watch simulator. If no
  iPhone 17 Pro pair exists yet, it creates one with an available unpaired
  Apple Watch simulator.
