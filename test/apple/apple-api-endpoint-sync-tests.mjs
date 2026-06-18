import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sharedPath = resolve(
  "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/AppleApiEndpointSync.swift",
);
const detailSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/MatchDetailView.swift"),
  "utf8",
);
const iosAppSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/HockeyTimerIOSApp.swift"),
  "utf8",
);
const watchAppSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/HockeyTimerWatchApp.swift"),
  "utf8",
);
const watchModelSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchMatchViewModel.swift"),
  "utf8",
);

if (!existsSync(sharedPath)) {
  throw new Error("shared AppleApiEndpointSync.swift must exist");
}

const sharedSource = readFileSync(sharedPath, "utf8");

for (const marker of [
  "import WatchConnectivity",
  "final class AppleApiEndpointSync",
  "static let shared",
  "hockey_timer_api_base",
  "updateApplicationContext",
  "sendMessage",
  "didReceiveApplicationContext applicationContext",
  "didReceiveMessage message",
  "publishCurrentEndpoint()",
  "start()",
]) {
  if (!sharedSource.includes(marker)) {
    throw new Error(`AppleApiEndpointSync missing ${marker}`);
  }
}

if (!detailSource.includes("AppleApiEndpointSync.shared.updateEndpoint(apiBaseDraft)")) {
  throw new Error("iPhone API save must publish endpoint through AppleApiEndpointSync");
}

if (!iosAppSource.includes("AppleApiEndpointSync.shared.start()")) {
  throw new Error("iPhone app must start API endpoint sync");
}

if (!watchAppSource.includes("AppleApiEndpointSync.shared.start()")) {
  throw new Error("watch app must start API endpoint sync");
}

if (!watchModelSource.includes("AppleApiEndpointSync.shared.start()")) {
  throw new Error("watch model must initialize endpoint sync before reading API base");
}

console.log("Apple API endpoint sync tests passed");
