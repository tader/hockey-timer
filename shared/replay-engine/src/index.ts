import {
  type MatchEvent,
  type MatchProjection,
  type ScoreChangedPayload,
  sortEvents,
} from "@hockey-timer/event-schema";

const DEFAULT_FORMAT = {
  periodCount: 4,
  periodDurationSeconds: [1050, 1050, 1050, 1050],
};

export function replayMatch(events: MatchEvent[], matchId: string): MatchProjection {
  const ordered = sortEvents(events.filter((event) => event.matchId === matchId));

  let homeScore = 0;
  let awayScore = 0;
  let isRunning = false;
  let isEnded = false;
  let currentPeriod = 1;
  let totalPlayedSeconds = 0;
  let currentPeriodPlayedSeconds = 0;
  let runningFrom: Date | null = null;
  let format = DEFAULT_FORMAT;

  for (const event of ordered) {
    const occurredAt = new Date(event.occurredAt);

    if (event.eventType === "score.changed") {
      const payload = event.payload as ScoreChangedPayload;
      if (payload.team === "home") {
        homeScore += payload.delta;
      } else {
        awayScore += payload.delta;
      }
    }

    if (event.eventType === "match.format.updated") {
      format = {
        periodCount: (event.payload as { periodCount: number }).periodCount,
        periodDurationSeconds: (event.payload as { periodDurationSeconds: number[] }).periodDurationSeconds,
      };
    }

    if (event.eventType === "match.started" || event.eventType === "match.resumed") {
      if (isEnded) {
        continue;
      }
      isRunning = true;
      runningFrom = occurredAt;
    }

    if (event.eventType === "match.paused" || event.eventType === "match.ended" || event.eventType === "period.ended") {
      if (runningFrom) {
        const delta = Math.max(0, Math.floor((occurredAt.getTime() - runningFrom.getTime()) / 1000));
        totalPlayedSeconds += delta;
        currentPeriodPlayedSeconds += delta;
      }
      isRunning = false;
      runningFrom = null;
    }

    if (event.eventType === "period.started") {
      const p = (event.payload as { period?: number }).period;
      currentPeriod = p ?? currentPeriod;
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "period.ended") {
      currentPeriod = Math.min(format.periodCount, currentPeriod + 1);
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "match.ended") {
      isEnded = true;
    }
  }

  if (isRunning && runningFrom) {
    const liveDelta = Math.max(0, Math.floor((Date.now() - runningFrom.getTime()) / 1000));
    totalPlayedSeconds += liveDelta;
    currentPeriodPlayedSeconds += liveDelta;
  }

  return {
    matchId,
    homeScore,
    awayScore,
    isRunning,
    isEnded,
    currentPeriod,
    playedSeconds: totalPlayedSeconds,
    totalPlayedSeconds,
    currentPeriodPlayedSeconds,
    format,
    lastEventAt: ordered[ordered.length - 1]?.occurredAt,
  };
}
