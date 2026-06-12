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
