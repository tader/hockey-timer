import test from "node:test";
import assert from "node:assert/strict";
import { sortEvents, validateEvent, type MatchEvent } from "../src/index.ts";

const baseEvent = {
  matchId: "m-1",
  occurredAt: "2026-03-15T14:45:00.000Z",
  originPlatform: "web",
  payload: {},
  version: 1 as const,
};

test("sortEvents orders by occurredAt then device+sequence", () => {
  const events: MatchEvent[] = [
    {
      ...baseEvent,
      eventId: "11111111-1111-4111-8111-111111111111",
      eventType: "match.started",
      originDeviceId: "b-device",
      sequence: 2,
    },
    {
      ...baseEvent,
      eventId: "22222222-2222-4222-8222-222222222222",
      eventType: "match.started",
      originDeviceId: "a-device",
      sequence: 5,
    },
    {
      ...baseEvent,
      eventId: "33333333-3333-4333-8333-333333333333",
      eventType: "match.started",
      occurredAt: "2026-03-15T14:44:59.000Z",
      originDeviceId: "z-device",
      sequence: 1,
    },
  ];

  const ordered = sortEvents(events);
  assert.deepEqual(
    ordered.map((event) => event.eventId),
    [
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ],
  );
});

test("validateEvent reports UUID, date and sequence violations", () => {
  const invalid = {
    ...baseEvent,
    eventId: "not-a-uuid",
    eventType: "match.started",
    occurredAt: "bad-date",
    originDeviceId: "dev-1",
    sequence: -1,
  } as MatchEvent;

  const issues = validateEvent(invalid);
  assert.deepEqual(issues, [
    "eventId must be a UUID",
    "occurredAt must be a valid ISO timestamp",
    "sequence must be >= 0",
  ]);
});
