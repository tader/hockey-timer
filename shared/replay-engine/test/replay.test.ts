import test from "node:test";
import assert from "node:assert/strict";
import { replayMatch } from "../src/index.ts";
import type { MatchEvent } from "@hockey-timer/event-schema";

function event(overrides: Partial<MatchEvent>): MatchEvent {
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

test("replayMatch computes score, timing and period transitions", () => {
  const events: MatchEvent[] = [
    event({ eventType: "match.started", occurredAt: "2026-03-15T14:00:00.000Z", sequence: 1 }),
    event({
      eventType: "score.changed",
      occurredAt: "2026-03-15T14:01:00.000Z",
      payload: { team: "home", delta: 1, reason: "goal" },
      sequence: 2,
    }),
    event({
      eventType: "match.paused",
      occurredAt: "2026-03-15T14:02:30.000Z",
      sequence: 3,
    }),
    event({
      eventType: "period.ended",
      occurredAt: "2026-03-15T14:02:31.000Z",
      sequence: 4,
    }),
  ];

  const projection = replayMatch(events, "m-1");
  assert.equal(projection.homeScore, 1);
  assert.equal(projection.awayScore, 0);
  assert.equal(projection.isRunning, false);
  assert.equal(projection.currentPeriod, 2);
  assert.equal(projection.totalPlayedSeconds, 150);
  assert.equal(projection.currentPeriodPlayedSeconds, 0);
});

test("replayMatch applies format updates", () => {
  const events: MatchEvent[] = [
    event({
      eventType: "match.format.updated",
      payload: { periodCount: 2, periodDurationSeconds: [1200, 1200] },
      sequence: 1,
    }),
  ];
  const projection = replayMatch(events, "m-1");
  assert.equal(projection.format.periodCount, 2);
  assert.deepEqual(projection.format.periodDurationSeconds, [1200, 1200]);
});
