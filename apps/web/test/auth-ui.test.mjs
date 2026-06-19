import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(resolve("src/main.ts"), "utf8");
const config = readFileSync(resolve("public/config.js"), "utf8");

test("web auth is configured through runtime OIDC settings", () => {
  for (const marker of [
    "__AUTH_AUTHORIZATION_ENDPOINT__",
    "__AUTH_TOKEN_ENDPOINT__",
    "__AUTH_CLIENT_ID__",
    "__AUTH_SCOPE__",
    "__AUTH_REDIRECT_URI__",
  ]) {
    assert.ok(config.includes(marker), `config missing ${marker}`);
    assert.ok(source.includes(marker), `source missing ${marker}`);
  }
});

test("web app uses PKCE sign-in and bearer auth for API calls", () => {
  for (const marker of [
    "code_challenge_method",
    "S256",
    "authorization_code",
    "authFetch",
    "Sign in required for web API access.",
    "authorization",
    "renderAuthPanel",
    "Sign In",
  ]) {
    assert.ok(source.includes(marker), `source missing ${marker}`);
  }
  assert.equal(source.includes("identity_provider"), false);
  assert.equal(source.includes("connection"), false);
});
