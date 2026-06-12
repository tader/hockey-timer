#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
apple="$root/apps/apple/HockeyTimer/HockeyTimerIOS"

/usr/bin/ruby - "$apple" <<'RUBY'
apple = ARGV.fetch(0)
previews = {
  "MatchListView" => "HockeyTimerIOS/MatchListView.swift",
  "MatchDetailView" => "HockeyTimerIOS/MatchDetailView.swift",
  "MatchMetadataEditorView" => "HockeyTimerIOS/MatchListView.swift",
  "KNHBBrowserView" => "HockeyTimerIOS/KNHBBrowserView.swift",
  "WatchRootTabView" => "HockeyTimerWatch Watch App/WatchRootTabView.swift",
  "TimeTabView" => "HockeyTimerWatch Watch App/TimeTabView.swift",
  "ScoreTabView" => "HockeyTimerWatch Watch App/ScoreTabView.swift",
  "AdminTabView" => "HockeyTimerWatch Watch App/AdminTabView.swift",
  "NewMatchFormatPickerView" => "HockeyTimerWatch Watch App/TimeTabView.swift"
}

def string_token(source, start)
  hashes = 0
  hashes += 1 while source.getbyte(start + hashes) == 35
  quote = start + hashes
  return unless source.getbyte(quote) == 34

  multiline = source.byteslice(quote, 3) == '"""'
  opening = hashes + (multiline ? 3 : 1)
  closing = (multiline ? '"""' : '"') + ('#' * hashes)
  index = start + opening

  while index < source.bytesize
    if source.byteslice(index, closing.bytesize) == closing
      finish = index + closing.bytesize
      content_start = start + opening
      return [finish, source.byteslice(content_start, index - content_start)]
    end

    escape = '\\' + ('#' * hashes)
    if source.byteslice(index, escape.bytesize) == escape
      index += escape.bytesize + 1
    else
      index += 1
    end
  end

  [source.bytesize, source.byteslice(start + opening..)]
end

def blank(source, output, start, finish)
  (start...finish).each do |index|
    output.setbyte(index, 32) unless source.getbyte(index) == 10
  end
end

def sanitize(source)
  output = source.dup
  index = 0

  while index < source.bytesize
    if source.byteslice(index, 2) == '//'
      finish = source.index("\n", index) || source.bytesize
      blank(source, output, index, finish)
      index = finish
    elsif source.byteslice(index, 2) == '/*'
      depth = 1
      finish = index + 2
      while finish < source.bytesize && depth.positive?
        if source.byteslice(finish, 2) == '/*'
          depth += 1
          finish += 2
        elsif source.byteslice(finish, 2) == '*/'
          depth -= 1
          finish += 2
        else
          finish += 1
        end
      end
      blank(source, output, index, finish)
      index = finish
    elsif (token = string_token(source, index))
      finish, = token
      blank(source, output, index, finish)
      index = finish
    else
      index += 1
    end
  end

  output
end

def preview_count(source, sanitized, view)
  count = 0
  sanitized.to_enum(:scan, /^[ \t]*#Preview[ \t]*\(/).each do
    label_start = Regexp.last_match.end(0)
    label_start += 1 while [9, 32].include?(source.getbyte(label_start))
    token = string_token(source, label_start)
    next unless token

    _, label = token
    count += 1 if label == view || label.start_with?("#{view} ", "#{view}-")
  end
  count
end

previews.each do |view, relative_path|
  source = File.binread(File.join(apple, relative_path))
  count = preview_count(source, sanitize(source), view)
  if count.zero?
    warn "missing preview: #{view}"
    exit 1
  elsif count != 1
    warn "duplicate preview: #{view} (#{count} found)"
    exit 1
  end
end

ios_sources = Dir[File.join(apple, "HockeyTimerIOS", "*.swift")]
fixtures = ios_sources.any? do |file|
  sanitize(File.binread(file)).match?(/^[ \t]*enum[ \t]+IOSPreviewFixtures[ \t]*(?=[:{])/)
end
exit 1 unless fixtures

factories = [
  File.join(apple, "HockeyTimerIOS", "IOSMatchViewModel.swift"),
  File.join(apple, "HockeyTimerWatch Watch App", "WatchMatchViewModel.swift")
]
factories.each do |file|
  exit 1 unless sanitize(File.binread(file)).match?(/\bstatic\s+func\s+preview\s*\(/)
end
RUBY

echo "swiftui preview contract tests passed"
