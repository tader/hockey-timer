import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/AdminTabView.swift"),
  "utf8",
);
const settingsPath = resolve(
  "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchApiSettingsView.swift",
);

if (adminSource.includes("API Settings") || adminSource.includes("WatchApiSettingsView")) {
  throw new Error("watch admin UI must not expose API settings editing");
}

if (existsSync(settingsPath)) {
  throw new Error("WatchApiSettingsView should be removed; iPhone owns API configuration");
}

console.log("watch API settings removal tests passed");
