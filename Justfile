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

# Rebuilds apps/web on source changes and restarts the local static server.
dev-web:
  #!/usr/bin/env zsh
  set -euo pipefail

  watch_hash() {
    {
      find apps/web/src -type f 2>/dev/null
      echo apps/web/index.html
    } | sort | xargs shasum | shasum | awk '{print $1}'
  }

  cleanup() {
    if [[ -n "${serve_pid:-}" ]]; then
      kill "${serve_pid}" 2>/dev/null || true
      wait "${serve_pid}" 2>/dev/null || true
    fi
  }

  restart_server() {
    echo "[dev-web] Building web app..."
    npm run build:web
    if [[ -n "${serve_pid:-}" ]]; then
      kill "${serve_pid}" 2>/dev/null || true
      wait "${serve_pid}" 2>/dev/null || true
    fi
    echo "[dev-web] Starting web server on :4173"
    npm run -w @hockey-timer/web serve &
    serve_pid=$!
  }

  trap cleanup EXIT INT TERM
  last_hash=""
  restart_server
  last_hash="$(watch_hash)"
  echo "[dev-web] Watching for changes in apps/web/src and apps/web/index.html ..."
  while true; do
    current_hash="$(watch_hash)"
    if [[ "${current_hash}" != "${last_hash}" ]]; then
      last_hash="${current_hash}"
      restart_server
    fi
    sleep 1
  done
