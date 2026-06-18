import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const endpointSync = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/AppleApiEndpointSync.swift"),
  "utf8",
);
const matchSync = readFileSync(
  resolve("apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift"),
  "utf8",
);

for (const marker of [
  "hockey_timer_auth_access_token",
  "updateAuthState(accessToken: String, expiresAt: Date)",
  "clearAuthState()",
  "currentAuthorizationHeader()",
  "publishCurrentAuthState()",
  "authAccessToken",
  "authExpiresAt",
  "applyAuthState(from:",
]) {
  if (!endpointSync.includes(marker)) {
    throw new Error(`Apple auth sync missing ${marker}`);
  }
}

if (!matchSync.includes('request.addValue(authorization, forHTTPHeaderField: "authorization")')) {
  throw new Error("Apple match sync must attach authorization header when auth state is present");
}

console.log("Apple auth sync tests passed");
