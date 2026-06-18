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
    const unauthorized = await fetch(`http://127.0.0.1:${port}/matches/auth-match/projection`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`http://127.0.0.1:${port}/matches/auth-match/projection`, {
      headers: { authorization: "Bearer local-test-token" },
    });
    assert.equal(authorized.status, 200);
  } finally {
    child.kill();
  }
});
