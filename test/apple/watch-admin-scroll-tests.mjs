import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(
  "apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerWatch Watch App/AdminTabView.swift",
);
const source = readFileSync(sourcePath, "utf8");

if (!source.includes("ScrollView")) {
  throw new Error("AdminTabView must use ScrollView so small watch screens can reach API settings");
}

console.log("watch admin scroll tests passed");
