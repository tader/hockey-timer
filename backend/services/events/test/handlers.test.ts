import test from "node:test";
import assert from "node:assert/strict";
import { batchUpsertHandler, listEventsHandler, listMatchesHandler, projectionHandler } from "../src/handlers.ts";
import { __resetStoreForTests } from "../src/store.ts";
import type { MatchEvent } from "@hockey-timer/event-schema";

function buildEvent(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    eventId: crypto.randomUUID(),
    matchId: "m-1",
    eventType: "match.started",
    occurredAt: "2026-03-15T14:00:00.000Z",
    originDeviceId: "dev-1",
    originPlatform: "web",
    sequence: 1,
    payload: {},
    version: 1,
    ...overrides,
  };
}

test("batchUpsertHandler validates, filters by route match id, and deduplicates", async () => {
  __resetStoreForTests();
  const valid = buildEvent({ eventId: "11111111-1111-4111-8111-111111111111" });
  const wrongMatch = buildEvent({
    eventId: "22222222-2222-4222-8222-222222222222",
    matchId: "other",
  });

  const first = await batchUpsertHandler({
    pathParameters: { id: "m-1" },
    body: JSON.stringify({ events: [valid, wrongMatch] }),
  });
  assert.equal(first.statusCode, 200);
  const firstBody = JSON.parse(first.body) as { inserted: number; duplicates: number; totalKnownEvents: number };
  assert.equal(firstBody.inserted, 1);
  assert.equal(firstBody.duplicates, 0);
  assert.equal(firstBody.totalKnownEvents, 1);

  const second = await batchUpsertHandler({
    pathParameters: { id: "m-1" },
    body: JSON.stringify({ events: [valid] }),
  });
  const secondBody = JSON.parse(second.body) as { inserted: number; duplicates: number };
  assert.equal(secondBody.inserted, 0);
  assert.equal(secondBody.duplicates, 1);
});

test("batchUpsertHandler returns 422 for invalid event payload", async () => {
  __resetStoreForTests();
  const invalid = buildEvent({
    eventId: "not-uuid",
    occurredAt: "bad-date",
    sequence: -1,
  });
  const response = await batchUpsertHandler({
    pathParameters: { id: "m-1" },
    body: JSON.stringify({ events: [invalid] }),
  });
  assert.equal(response.statusCode, 422);
  const body = JSON.parse(response.body) as { validationErrors: Array<{ issues: string[] }> };
  assert.equal(body.validationErrors.length, 1);
  assert.ok(body.validationErrors[0].issues.includes("eventId must be a UUID"));
});

test("listEventsHandler and projectionHandler expose ordered events and projection", async () => {
  __resetStoreForTests();
  const events: MatchEvent[] = [
    buildEvent({ eventType: "match.started", occurredAt: "2026-03-15T14:00:00.000Z", sequence: 1 }),
    buildEvent({
      eventType: "score.changed",
      occurredAt: "2026-03-15T14:01:00.000Z",
      sequence: 2,
      payload: { team: "away", delta: 1, reason: "goal" },
    }),
    buildEvent({ eventType: "match.paused", occurredAt: "2026-03-15T14:02:00.000Z", sequence: 3 }),
  ];

  await batchUpsertHandler({
    pathParameters: { id: "m-1" },
    body: JSON.stringify({ events }),
  });

  const listed = await listEventsHandler({ pathParameters: { id: "m-1" } });
  assert.equal(listed.statusCode, 200);
  const listedBody = JSON.parse(listed.body) as { events: MatchEvent[] };
  assert.equal(listedBody.events.length, 3);
  assert.equal(listedBody.events[1].eventType, "score.changed");

  const projection = await projectionHandler({ pathParameters: { id: "m-1" } });
  assert.equal(projection.statusCode, 200);
  const projectionBody = JSON.parse(projection.body) as {
    awayScore: number;
    homeScore: number;
    isRunning: boolean;
    totalPlayedSeconds: number;
  };
  assert.equal(projectionBody.homeScore, 0);
  assert.equal(projectionBody.awayScore, 1);
  assert.equal(projectionBody.isRunning, false);
  assert.equal(projectionBody.totalPlayedSeconds, 120);
});

test("listMatchesHandler derives match catalog from metadata events", async () => {
  __resetStoreForTests();
  await batchUpsertHandler({
    pathParameters: { id: "catalog-match" },
    body: JSON.stringify({
      events: [
        buildEvent({
          eventId: "11111111-1111-4111-8111-111111111111",
          matchId: "catalog-match",
          eventType: "match.created",
          payload: {
            source: "web-custom",
            homeTeam: "Blue",
            awayTeam: "White",
            matchDateTime: "2026-03-16T12:00:00.000Z",
            location: "Main Club",
            knhbMatchId: "knhb-1",
          },
        }),
        buildEvent({
          eventId: "22222222-2222-4222-8222-222222222222",
          matchId: "catalog-match",
          eventType: "match.updated",
          occurredAt: "2026-03-15T14:01:00.000Z",
          sequence: 2,
          payload: {
            source: "web-custom",
            homeTeam: "Blue Updated",
            awayTeam: "White",
            matchDateTime: "2026-03-16T12:00:00.000Z",
            teamName: "Ladies 1",
          },
        }),
      ],
    }),
  });

  const response = await listMatchesHandler({});

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as {
    matches: Array<{ id: string; homeTeam: string; awayTeam: string; clubName?: string; teamName?: string }>;
  };
  assert.equal(body.matches.length, 1);
  assert.equal(body.matches[0].id, "catalog-match");
  assert.equal(body.matches[0].homeTeam, "Blue Updated");
  assert.equal(body.matches[0].clubName, "Main Club");
  assert.equal(body.matches[0].teamName, "Ladies 1");
});
