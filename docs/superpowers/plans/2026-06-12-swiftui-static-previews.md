# SwiftUI Static Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, populated `#Preview` definitions for all nine SwiftUI views without preview-time network or persistence work.

**Architecture:** Add preview mode to the shared sync model, then target-specific static fixture factories. Inject models and initial collections into views that currently own live dependencies while preserving production defaults.

**Tech Stack:** Swift, SwiftUI, Combine, Xcode simulator builds, shell contract test.

---

## File Map

- Create `test/apple/swiftui-preview-contract-tests.sh`: verify all nine views have previews and preview fixtures exist.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift`: preview-safe mode and deterministic state seeding.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/IOSMatchViewModel.swift`: iOS preview factory.
- Create `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/IOSPreviewFixtures.swift`: static iOS match and KNHB fixtures.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/MatchListView.swift`: injected initial matches plus two previews.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/MatchDetailView.swift`: injected model plus preview.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/KNHBBrowserView.swift`: injected seeded model/favorites plus preview.
- Modify `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchMatchViewModel.swift`: watch preview factories.
- Modify four watch view files: add previews and inject root model.
- Modify `docs/tasks.md`: record completed preview coverage.

### Task 1: Add Preview Contract Test

**Files:**
- Create: `test/apple/swiftui-preview-contract-tests.sh`

- [ ] **Step 1: Write failing contract test**

Create executable script that searches Apple Swift sources, requires exactly one named preview per view, and requires `IOSPreviewFixtures`, `IOSMatchViewModel.preview`, and `WatchMatchViewModel.preview`:

```bash
#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
apple="$root/apps/apple/HockeyTimer/HockeyTimerIOS"
views=(MatchListView MatchDetailView MatchMetadataEditorView KNHBBrowserView WatchRootTabView TimeTabView ScoreTabView AdminTabView NewMatchFormatPickerView)

for view in "${views[@]}"; do
  rg -q "#Preview\(\"$view" "$apple" || {
    echo "missing preview: $view" >&2
    exit 1
  }
done

rg -q 'enum IOSPreviewFixtures' "$apple/HockeyTimerIOS"
rg -q 'static func preview' "$apple/HockeyTimerIOS/IOSMatchViewModel.swift"
rg -q 'static func preview' "$apple/HockeyTimerWatch Watch App/WatchMatchViewModel.swift"
echo "swiftui preview contract tests passed"
```

- [ ] **Step 2: Verify red state**

Run: `rtk bash test/apple/swiftui-preview-contract-tests.sh`

Expected: FAIL with `missing preview: MatchListView`.

- [ ] **Step 3: Commit test**

```bash
git add test/apple/swiftui-preview-contract-tests.sh
git commit -m "test: define SwiftUI preview coverage"
```

### Task 2: Add Preview-Safe Sync Models

**Files:**
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/IOSMatchViewModel.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchMatchViewModel.swift`

- [ ] **Step 1: Add preview mode to shared model**

Add `isPreview` and `previewApiBase` initializer parameters with production defaults. In preview mode, skip local projection loading, pending-count task, refresh, API-base persistence, and event pushes. Add one seeding method:

```swift
func seedPreview(
    homeScore: Int,
    awayScore: Int,
    isRunning: Bool,
    isEnded: Bool,
    currentPeriod: Int,
    currentPeriodPlayedSeconds: Int,
    periodCount: Int,
    periodDurationSeconds: Int,
    pendingEventCount: Int = 0,
    runningStartedAt: Date? = nil,
    lastError: String? = nil
) {
    guard isPreview else { return }
    self.homeScore = homeScore
    self.awayScore = awayScore
    self.isRunning = isRunning
    self.isEnded = isEnded
    self.currentPeriod = currentPeriod
    self.currentPeriodPlayedSeconds = currentPeriodPlayedSeconds
    self.periodCount = periodCount
    self.periodDurationSeconds = periodDurationSeconds
    self.periodDurationSecondsByPeriod = Array(repeating: periodDurationSeconds, count: periodCount)
    self.pendingEventCount = pendingEventCount
    self.runningStartedAt = runningStartedAt
    self.lastError = lastError
}
```

- [ ] **Step 2: Add target model factories**

Implement `IOSMatchViewModel.preview(...)` and `WatchMatchViewModel.preview(...)`. Factories construct with `isPreview: true`, call `seedPreview`, and return the model. Use fixed scores and period values supplied by callers.

- [ ] **Step 3: Compile shared changes**

Run: `rtk just build-all-sim`

Expected: both schemes end with `BUILD SUCCEEDED`.

- [ ] **Step 4: Commit model support**

```bash
git add apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift \
  apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/IOSMatchViewModel.swift \
  "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchMatchViewModel.swift"
git commit -m "feat: add preview-safe match models"
```

### Task 3: Add iOS Fixtures and Previews

**Files:**
- Create: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/IOSPreviewFixtures.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/MatchListView.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/MatchDetailView.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/KNHBBrowserView.swift`

- [ ] **Step 1: Add deterministic iOS fixtures**

Define `IOSPreviewFixtures` with fixed UTC dates, three `MatchListItem` values, clubs, teams, upcoming matches, and one favorite team. No `Date()` or UUID-generated fixture values.

- [ ] **Step 2: Inject match-list initial state**

Add `init(matches: [MatchListItem]? = nil)` and a private persistence flag. Seed `_matches` when supplied; skip `MatchStore.shared.load()` during preview. Add:

```swift
#Preview("MatchListView - Populated") {
    NavigationStack {
        MatchListView(matches: IOSPreviewFixtures.matches)
    }
}
```

- [ ] **Step 3: Add metadata editor preview**

```swift
#Preview("MatchMetadataEditorView - Populated") {
    NavigationStack {
        MatchMetadataEditorView(
            title: "Edit Match",
            match: IOSPreviewFixtures.matches[0],
            onSave: { _ in }
        )
    }
}
```

- [ ] **Step 4: Inject detail model and add preview**

Extend `MatchDetailView.init` with optional `model`. Preserve `IOSMatchViewModel(matchId:)` default. Preview injects active static model and fixed match.

- [ ] **Step 5: Inject KNHB model and favorites**

Give `KNHBBrowserViewModel` preview mode plus seeded initializer. Give `KNHBBrowserView` an initializer accepting model and favorite list; skip store loading and automatic API load for injected preview data. Add populated preview inside `NavigationStack`.

- [ ] **Step 6: Verify contract progresses**

Run: `rtk bash test/apple/swiftui-preview-contract-tests.sh`

Expected: FAIL first missing watch preview, proving all iOS preview checks passed.

- [ ] **Step 7: Build iOS and commit**

Run: `rtk just build-ios-sim`

Expected: `BUILD SUCCEEDED`.

```bash
git add apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS
git commit -m "feat: add static iOS previews"
```

### Task 4: Add watchOS Previews

**Files:**
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchRootTabView.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/TimeTabView.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/ScoreTabView.swift`
- Modify: `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/AdminTabView.swift`

- [ ] **Step 1: Inject root model**

Add `WatchRootTabView.init(model: WatchMatchViewModel = WatchMatchViewModel())` using `_model = StateObject(wrappedValue:)`. Preview injects a running static model; refresh calls become no-ops in preview mode.

- [ ] **Step 2: Add leaf previews**

Add named previews for `TimeTabView`, `ScoreTabView`, `AdminTabView`, and `NewMatchFormatPickerView`. Each attaches a purpose-built static model through `.environmentObject(...)`. Use running state for time, score `2-1` for score, paused period 3 for admin, and ended state for format picker.

- [ ] **Step 3: Verify green contract**

Run: `rtk bash test/apple/swiftui-preview-contract-tests.sh`

Expected: `swiftui preview contract tests passed`.

- [ ] **Step 4: Build watch target and commit**

Run: `rtk just build-watch-sim`

Expected: `BUILD SUCCEEDED`.

```bash
git add "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App"
git commit -m "feat: add static watchOS previews"
```

### Task 5: Document and Verify

**Files:**
- Modify: `docs/tasks.md`

- [ ] **Step 1: Record completion**

Add completed item: all nine Apple SwiftUI views now have deterministic static previews; preview models suppress networking, polling effects, and persistence access.

- [ ] **Step 2: Run full verification**

```bash
rtk bash test/apple/swiftui-preview-contract-tests.sh
rtk just build-all-sim
rtk git diff --check
rtk git status --short
```

Expected: contract PASS, both builds succeed, no whitespace errors. Only intended files plus pre-existing user changes remain.

- [ ] **Step 3: Commit documentation**

```bash
git add docs/tasks.md
git commit -m "docs: record SwiftUI preview coverage"
```
