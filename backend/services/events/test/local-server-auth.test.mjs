import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";
import { test } from "node:test";
import assert from "node:assert/strict";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  return address.port;
}

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ["local-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_MODE: "required",
      AUTH_DEV_BEARER_TOKEN: "local-test-token",
      PORT: String(port),
      STORAGE_DRIVER: "sqlite",
      SQLITE_PATH: ":memory:",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });

  while (!output.includes("events service listening")) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early: ${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return { child, port };
}

test("local server requires bearer token when auth mode is required", async () => {
  const { child, port } = await startServer();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);

    const preflight = await fetch(`http://127.0.0.1:${port}/matches/auth-match/projection`, {
      method: "OPTIONS",
      headers: {
        origin: "https://hockey.tader.nl",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /authorization/);

    const unauthorized = await fetch(`http://127.0.0.1:${port}/matches/auth-match/projection`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`http://127.0.0.1:${port}/matches/auth-match/projection`, {
      headers: { authorization: "Bearer local-test-token" },
    });
    assert.equal(authorized.status, 200);

    const metadataEvent = {
      eventId: "11111111-1111-4111-8111-111111111111",
      matchId: "remote-match",
      eventType: "match.created",
      occurredAt: "2026-03-15T14:00:00.000Z",
      originDeviceId: "test",
      originPlatform: "web",
      sequence: 1,
      payload: { homeTeam: "Remote Home", awayTeam: "Remote Away" },
      version: 1,
    };
    const upsert = await fetch(`http://127.0.0.1:${port}/matches/remote-match/events:batchUpsert`, {
      method: "POST",
      headers: {
        authorization: "Bearer local-test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ events: [metadataEvent] }),
    });
    assert.equal(upsert.status, 200);

    const catalog = await fetch(`http://127.0.0.1:${port}/matches`, {
      headers: { authorization: "Bearer local-test-token" },
    });
    assert.equal(catalog.status, 200);
    const body = await catalog.json();
    assert.equal(body.matches[0].id, "remote-match");
    assert.equal(body.matches[0].homeTeam, "Remote Home");
  } finally {
    child.kill();
  }
});
