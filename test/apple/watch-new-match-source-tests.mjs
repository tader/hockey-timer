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

if (!sharedSource.includes("func createQuickMatch")) {
  throw new Error("MatchSyncViewModel needs createQuickMatch for ended-watch restart");
}

if (!sharedSource.includes("match.format.updated")) {
  throw new Error("quick match creation must emit match.format.updated");
}

if (!timeTabSource.includes("Other Format")) {
  throw new Error("ended timer screen needs Other Format access");
}

console.log("watch new match source tests passed");
