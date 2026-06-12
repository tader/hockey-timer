# SwiftUI Static Previews Design

## Goal

Add deterministic SwiftUI previews for every Apple `View` type. Previews show
useful populated states without network requests, polling, or persistent-store
writes.

## Scope

Add `#Preview` coverage for all nine views:

- `MatchListView`
- `MatchDetailView`
- `MatchMetadataEditorView`
- `KNHBBrowserView`
- `WatchRootTabView`
- `TimeTabView`
- `ScoreTabView`
- `AdminTabView`
- `NewMatchFormatPickerView`

## Approach

Use dependency injection with static preview factories.

- Add deterministic fixture values for match metadata, KNHB options, upcoming
  matches, favorites, scores, period state, timer state, and pending events.
- Allow views that currently construct live models or load stores internally to
  receive seeded state or models.
- Keep existing default initializers and runtime behavior unchanged.
- Add a preview-safe model mode that suppresses projection refreshes, event
  submission, polling, and persistence access.
- Keep fixtures near Apple UI code unless sharing between iOS and watchOS
  materially reduces duplication.

## Preview States

### iOS

- Match list: several dated matches with custom and KNHB metadata.
- Match detail: active match with non-zero score, current period, remaining
  time, and API value.
- Metadata editor: populated teams, club, team, and match date.
- KNHB browser: populated favorites, clubs, selected team, and upcoming matches.

### watchOS

- Root tab: active running match.
- Time tab: running match with score and remaining time.
- Score tab: non-zero score with enabled correction controls.
- Admin tab: paused active match with period controls.
- Format picker: available static match formats.

## Runtime Isolation

Preview construction must not:

- call backend APIs;
- start recurring projection polling;
- enqueue or submit match events;
- read or write match/favorite persistence;
- depend on current date for displayed fixture content.

Production initializers retain current networking, persistence, and polling.

## Validation

- Confirm each view declaration has a corresponding `#Preview`.
- Build iOS simulator target with `just build-ios-sim`.
- Build watchOS simulator target with `just build-watch-sim`.
- Review git diff for fixture isolation and unchanged production defaults.

## Documentation

Record completion in `docs/tasks.md`. No architecture or product decision changes
required.
