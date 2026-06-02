import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sharedSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift"),
  "utf8",
);
const timeTabSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/TimeTabView.swift"),
  "utf8",
);

if (!sharedSource.includes("applyLocal(event:")) {
  throw new Error("MatchSyncViewModel must apply events locally before sync");
}

if (!sharedSource.includes("runningStartedAt")) {
  throw new Error("MatchSyncViewModel must track local runningStartedAt for offline time");
}

if (!sharedSource.includes("saveLocalProjection")) {
  throw new Error("MatchSyncViewModel must persist local projection for offline watch restart");
}

if (!timeTabSource.includes("TimelineView")) {
  throw new Error("TimeTabView must render live local time without waiting for network polling");
}

console.log("watch offline source tests passed");
