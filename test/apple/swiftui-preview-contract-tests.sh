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

  strip_inactive_blocks(output)
end

def strip_inactive_blocks(source)
  output = source.dup
  stack = []
  offset = 0

  source.each_line do |line|
    directive = line.match(/^[ \t]*#(if|elseif|else|endif)\b(?:[ \t]+(.*?))?[ \t]*$/)
    inactive = stack.any? { |frame| frame[:inactive] }

    if directive
      command = directive[1]
      condition = directive[2]&.strip
      case command
      when "if"
        stack << { inactive: inactive || condition == "false", false_branch: condition == "false" }
      when "elseif"
        if stack.any? && stack.last[:false_branch]
          parent_inactive = stack[0...-1].any? { |frame| frame[:inactive] }
          stack.last[:inactive] = parent_inactive || condition == "false"
          stack.last[:false_branch] = condition == "false"
        end
      when "else"
        if stack.any? && stack.last[:false_branch]
          parent_inactive = stack[0...-1].any? { |frame| frame[:inactive] }
          stack.last[:inactive] = parent_inactive
          stack.last[:false_branch] = false
        end
      when "endif"
        stack.pop
      end
      blank(source, output, offset, offset + line.bytesize)
    elsif inactive
      blank(source, output, offset, offset + line.bytesize)
    end

    offset += line.bytesize
  end

  output
end

def type_body(source, type_name)
  declaration = source.match(/\b(?:class|struct|actor)\s+#{Regexp.escape(type_name)}\b/)
  return unless declaration

  opening = source.index("{", declaration.end(0))
  return unless opening

  depth = 1
  index = opening + 1
  while index < source.bytesize && depth.positive?
    case source.getbyte(index)
    when 123 then depth += 1
    when 125 then depth -= 1
    end
    index += 1
  end
  return unless depth.zero?

  source.byteslice(opening + 1, index - opening - 2)
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

factories = {
  "IOSMatchViewModel" => File.join(apple, "HockeyTimerIOS", "IOSMatchViewModel.swift"),
  "WatchMatchViewModel" => File.join(apple, "HockeyTimerWatch Watch App", "WatchMatchViewModel.swift")
}
factories.each do |type_name, file|
  body = type_body(sanitize(File.binread(file)), type_name)
  exit 1 unless body&.match?(/\bstatic\s+func\s+preview\s*\(/)
end
RUBY

echo "swiftui preview contract tests passed"
