import test from "node:test";
import assert from "node:assert/strict";
import { batchUpsertHandler, listEventsHandler, projectionHandler } from "../src/handlers.ts";
import { __resetStoreForTests } from "../src/store.ts";
import type { MatchEvent } from "@hockey-timer/event-schema";

const previousAuthMode = process.env.AUTH_MODE;
const previousDevToken = process.env.AUTH_DEV_BEARER_TOKEN;

function buildEvent(): MatchEvent {
  return {
    eventId: "11111111-1111-4111-8111-111111111111",
    matchId: "auth-match",
    eventType: "match.started",
    occurredAt: "2026-03-15T14:00:00.000Z",
    originDeviceId: "dev-1",
    originPlatform: "web",
    sequence: 1,
    payload: {},
    version: 1,
  };
}

test.afterEach(() => {
  if (previousAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = previousAuthMode;

  if (previousDevToken === undefined) delete process.env.AUTH_DEV_BEARER_TOKEN;
  else process.env.AUTH_DEV_BEARER_TOKEN = previousDevToken;

  __resetStoreForTests();
});

test("match API rejects missing bearer token when auth is required", async () => {
  process.env.AUTH_MODE = "required";
  process.env.AUTH_DEV_BEARER_TOKEN = "test-token";

  const upsert = await batchUpsertHandler({
    pathParameters: { id: "auth-match" },
    body: JSON.stringify({ events: [buildEvent()] }),
  });
  assert.equal(upsert.statusCode, 401);

  const events = await listEventsHandler({ pathParameters: { id: "auth-match" } });
  assert.equal(events.statusCode, 401);

  const projection = await projectionHandler({ pathParameters: { id: "auth-match" } });
  assert.equal(projection.statusCode, 401);
});

test("match API accepts configured bearer token when auth is required", async () => {
  process.env.AUTH_MODE = "required";
  process.env.AUTH_DEV_BEARER_TOKEN = "test-token";

  const response = await batchUpsertHandler({
    pathParameters: { id: "auth-match" },
    headers: { authorization: "Bearer test-token" },
    body: JSON.stringify({ events: [buildEvent()] }),
  });

  assert.equal(response.statusCode, 200);
});
