import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/WatchRootTabView.swift"),
  "utf8",
);
const timeSource = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/TimeTabView.swift"),
  "utf8",
);

const tabOrder = [
  "AdminTabView()",
  "TimeTabView()",
  "ScoreTabView()",
].map((marker) => rootSource.indexOf(marker));

if (tabOrder.some((index) => index === -1)) {
  throw new Error("watch root must include Admin, Time, and Score tabs");
}

if (!(tabOrder[0] < tabOrder[1] && tabOrder[1] < tabOrder[2])) {
  throw new Error("watch tabs must be ordered left-to-right: Admin, Time, Score");
}

if (!rootSource.includes("@State private var selectedTab = WatchTab.timer")) {
  throw new Error("watch root should still open on the middle Time tab");
}

if (!timeSource.includes("scoreButton(score: model.homeScore")) {
  throw new Error("TimeTabView must render scores through fixed rounded score buttons");
}

if (!timeSource.includes(".font(.system(size: 36")) {
  throw new Error("TimeTabView score font must be larger than title2");
}

if (!timeSource.includes(".frame(width: 58, height: 44)")) {
  throw new Error("TimeTabView score buttons must have fixed dimensions that fit score 99");
}

if (!timeSource.includes(".background(tint, in: RoundedRectangle(cornerRadius: 10")) {
  throw new Error("TimeTabView score button tint must be clipped to rounded corners");
}

if (timeSource.includes(".tint(.red)") || timeSource.includes(".tint(.blue)")) {
  throw new Error("TimeTabView score buttons must not rely on tint that leaves square background corners");
}

console.log("watch tab and time UI tests passed");
