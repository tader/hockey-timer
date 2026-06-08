import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";

async function getFreePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function startServer({ port, sqlitePath }) {
  const child = spawn(process.execPath, ["backend/services/events/local-server.mjs"], {
    cwd: new URL("../../../../", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      STORAGE_DRIVER: "sqlite",
      SQLITE_PATH: sqlitePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const deadline = Date.now() + 5000;
  while (!output.includes("events service listening")) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not start: ${output}`);
    }
    if (child.exitCode !== null) {
      throw new Error(`server exited before start: ${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return {
    async stop() {
      child.kill();
      await once(child, "exit");
    },
  };
}

test("local server keeps events after sqlite-backed restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hockey-timer-api-"));
  const sqlitePath = join(dir, "events.sqlite");
  const port = await getFreePort();
  const event = {
    eventId: "11111111-1111-4111-8111-111111111111",
    matchId: "persisted-match",
    eventType: "score.changed",
    occurredAt: "2026-03-15T14:01:00.000Z",
    originDeviceId: "dev-1",
    originPlatform: "web",
    sequence: 1,
    payload: { team: "home", delta: 1 },
    version: 1,
  };

  const first = await startServer({ port, sqlitePath });
  await fetch(`http://127.0.0.1:${port}/matches/persisted-match/events:batchUpsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [event] }),
  });
  await first.stop();

  const second = await startServer({ port, sqlitePath });
  const response = await fetch(`http://127.0.0.1:${port}/matches/persisted-match/projection`);
  const projection = await response.json();
  await second.stop();

  assert.equal(projection.homeScore, 1);
});
