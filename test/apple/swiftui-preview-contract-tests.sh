#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
apple="$root/apps/apple/HockeyTimer/HockeyTimerIOS"
previews=(
  "MatchListView|HockeyTimerIOS/MatchListView.swift"
  "MatchDetailView|HockeyTimerIOS/MatchDetailView.swift"
  "MatchMetadataEditorView|HockeyTimerIOS/MatchListView.swift"
  "KNHBBrowserView|HockeyTimerIOS/KNHBBrowserView.swift"
  "WatchRootTabView|HockeyTimerWatch Watch App/WatchRootTabView.swift"
  "TimeTabView|HockeyTimerWatch Watch App/TimeTabView.swift"
  "ScoreTabView|HockeyTimerWatch Watch App/ScoreTabView.swift"
  "AdminTabView|HockeyTimerWatch Watch App/AdminTabView.swift"
  "NewMatchFormatPickerView|HockeyTimerWatch Watch App/TimeTabView.swift"
)

for preview in "${previews[@]}"; do
  view="${preview%%|*}"
  file="$apple/${preview#*|}"
  count="$(VIEW="$view" perl -0777 -ne '
    $source = $_;
    @comments = ();
    while ($source =~ m{/\*.*?(?:\*/|\z)}gs) {
      push @comments, [$-[0], $+[0]];
    }

    $name = quotemeta $ENV{"VIEW"};
    $count = 0;
    while ($source =~ /^[ \t]*#Preview\s*\(\s*"$name(?="|[ -])/mg) {
      $offset = $-[0];
      $count++ unless grep { $_->[0] <= $offset && $offset < $_->[1] } @comments;
    }
    print $count;
  ' "$file")"

  if [[ "$count" -eq 0 ]]; then
    echo "missing preview: $view" >&2
    exit 1
  elif [[ "$count" -ne 1 ]]; then
    echo "duplicate preview: $view ($count found)" >&2
    exit 1
  fi
done

perl -0777 -ne '
  BEGIN { $found = 0; }
  s{/\*.*?\*/}{}gs;
  s{//[^\n]*}{}g;
  $found = 1 if /^[ \t]*enum[ \t]+IOSPreviewFixtures[ \t]*(?=[:{])/m;
  END { exit($found ? 0 : 1); }
' "$apple/HockeyTimerIOS"/*.swift

for file in \
  "$apple/HockeyTimerIOS/IOSMatchViewModel.swift" \
  "$apple/HockeyTimerWatch Watch App/WatchMatchViewModel.swift"; do
  perl -0777 -ne '
    s{/\*.*?\*/}{}gs;
    s{//[^\n]*}{}g;
    exit(/\bstatic\s+func\s+preview\s*\(/ ? 0 : 1);
  ' "$file"
done

echo "swiftui preview contract tests passed"
