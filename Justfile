set shell := ["zsh", "-lc"]

project := "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS.xcodeproj"
ios_scheme := "HockeyTimerIOS"
watch_scheme := "HockeyTimerWatch Watch App"
derived_ios := "/tmp/HockeyTimerDerivedData-ios"
derived_watch := "/tmp/HockeyTimerDerivedData-watch"

default:
  @just --list

list:
  xcodebuild -list -project {{project}}

build-ios-sim:
  xcodebuild -project "{{project}}" -scheme "{{ios_scheme}}" -configuration Debug -destination "generic/platform=iOS Simulator" -derivedDataPath "{{derived_ios}}-$(date +%s)" CODE_SIGNING_ALLOWED=NO build

build-watch-sim:
  xcodebuild -project "{{project}}" -scheme "{{watch_scheme}}" -configuration Debug -destination "generic/platform=watchOS Simulator" -derivedDataPath "{{derived_watch}}-$(date +%s)" CODE_SIGNING_ALLOWED=NO build

build-all-sim:
  just build-ios-sim
  just build-watch-sim

build-ios-device:
  xcodebuild -project "{{project}}" -scheme "{{ios_scheme}}" -configuration Debug -destination "generic/platform=iOS" -derivedDataPath "{{derived_ios}}-$(date +%s)" build

build-watch-device:
  xcodebuild -project "{{project}}" -scheme "{{watch_scheme}}" -configuration Debug -destination "generic/platform=watchOS" -derivedDataPath "{{derived_watch}}-$(date +%s)" build

# Starts Vite dev server with hot reload for the web app.
dev-web:
  npm run dev:web

# Starts local events service in watch mode.
dev-events:
  npm run dev:events
