set shell := ["zsh", "-lc"]

project := "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS.xcodeproj"
ios_scheme := "HockeyTimerIOS"
watch_scheme := "HockeyTimerWatch Watch App"
derived_ios := "/tmp/HockeyTimerDerivedData-ios"
derived_watch := "/tmp/HockeyTimerDerivedData-watch"
derived_install_ios := "/tmp/HockeyTimerDerivedData-install-ios"
derived_install_watch := "/tmp/HockeyTimerDerivedData-install-watch"
iphone_device := "1141CA4B-F44F-55A6-967A-E61ECA88B38E"
watch_device := "25CED29A-60BD-5609-BA9F-21EA516A4291"
sim_phone_name := "iPhone 17 Pro"

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

install target="all":
  #!/usr/bin/env zsh
  set -euo pipefail
  case "{{target}}" in
    phone)
      just _install-phone
      ;;
    watch)
      just _install-watch
      ;;
    all)
      just _install-phone
      just _install-watch
      ;;
    *)
      print -u2 "usage: just install [phone|watch]"
      exit 64
      ;;
  esac

_install-phone:
  rm -rf "{{derived_install_ios}}"
  xcodebuild -project "{{project}}" -scheme "{{ios_scheme}}" -configuration Debug -destination "id={{iphone_device}}" -derivedDataPath "{{derived_install_ios}}" build
  xcrun devicectl device install app --device "{{iphone_device}}" "{{derived_install_ios}}/Build/Products/Debug-iphoneos/HockeyTimerIOS.app"

_install-watch:
  rm -rf "{{derived_install_watch}}"
  xcodebuild -project "{{project}}" -scheme "{{watch_scheme}}" -configuration Debug -destination "id={{watch_device}}" -derivedDataPath "{{derived_install_watch}}" build
  xcrun devicectl device install app --device "{{watch_device}}" "{{derived_install_watch}}/Build/Products/Debug-watchos/HockeyTimerWatch Watch App.app"

sim:
  #!/usr/bin/env zsh
  set -euo pipefail
  export SIM_PHONE_NAME="{{sim_phone_name}}"
  pair_info=$(/usr/bin/ruby <<'RUBY'
  require "json"

  phone_name = ENV.fetch("SIM_PHONE_NAME")
  pairs = JSON.parse(`xcrun simctl list pairs --json`)["pairs"] || {}
  match = pairs.find { |_, pair| pair.dig("phone", "name") == phone_name }

  unless match
    devices = JSON.parse(`xcrun simctl list devices available --json`)["devices"].values.flatten
    phone = devices.find { |device| device["name"] == phone_name }

    if phone
      paired_watch_ids = pairs.values.map { |pair| pair.dig("watch", "udid") }.compact
      watch = devices.find do |device|
        device["name"].start_with?("Apple Watch") && !paired_watch_ids.include?(device["udid"])
      end
      abort "No unpaired available Apple Watch simulator found for #{phone_name}" unless watch

      system("xcrun", "simctl", "pair", watch["udid"], phone["udid"], out: File::NULL) ||
        abort("Failed to pair #{watch["name"]} with #{phone_name}")
      pairs = JSON.parse(`xcrun simctl list pairs --json`)["pairs"] || {}
      match = pairs.find { |_, pair| pair.dig("phone", "udid") == phone["udid"] }
      abort "Pair created but not found for #{phone_name}" unless match
    else
      match = pairs.find { |_, pair| pair.dig("phone", "name")&.start_with?(phone_name) }
      abort "No available simulator named #{phone_name}" unless match
    end
  end

  pair_id, pair = match
  puts [pair_id, pair.dig("phone", "udid"), pair.dig("watch", "udid")].join(" ")
  RUBY
  )
  read pair_id phone_id watch_id <<< "$pair_info"
  xcrun simctl boot "$pair_id" || true
  xcrun simctl bootstatus "$phone_id" -b
  open -a Simulator --args -CurrentDeviceUDID "$phone_id"
  open -a Simulator --args -CurrentDeviceUDID "$watch_id"

# Starts Vite dev server with hot reload for the web app.
dev-web:
  npm run dev:web

# Starts local events service in watch mode.
dev-events:
  npm run dev:events
