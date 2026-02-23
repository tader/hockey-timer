export type TeamSide = "home" | "away";

export type MatchEventType =
  | "match.created"
  | "match.started"
  | "match.paused"
  | "match.resumed"
  | "period.started"
  | "period.ended"
  | "score.changed"
  | "match.format.updated"
  | "match.ended";

export type MatchFormat = {
  periodCount: number;
  periodDurationSeconds: number[];
};

export type ScoreChangedPayload = {
  team: TeamSide;
  delta: number;
  reason: "goal" | "correction" | "manual";
};

export type MatchFormatUpdatedPayload = MatchFormat;

export type MatchEventPayload =
  | Record<string, never>
  | ScoreChangedPayload
  | MatchFormatUpdatedPayload;

export type MatchEvent = {
  eventId: string;
  matchId: string;
  eventType: MatchEventType;
  occurredAt: string;
  recordedAt?: string;
  originDeviceId: string;
  originPlatform: "watchos" | "ios" | "web" | "android" | "wear";
  sequence: number;
  payload: MatchEventPayload;
  version: 1;
};

export type MatchProjection = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  isRunning: boolean;
  isEnded: boolean;
  currentPeriod: number;
  playedSeconds: number;
  totalPlayedSeconds: number;
  currentPeriodPlayedSeconds: number;
  format: MatchFormat;
  lastEventAt?: string;
};

export function sortEvents(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) {
      return a.occurredAt.localeCompare(b.occurredAt);
    }

    const originKeyA = `${a.originDeviceId}:${String(a.sequence).padStart(12, "0")}`;
    const originKeyB = `${b.originDeviceId}:${String(b.sequence).padStart(12, "0")}`;
    return originKeyA.localeCompare(originKeyB);
  });
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateEvent(event: MatchEvent): string[] {
  const issues: string[] = [];

  if (!isValidUuid(event.eventId)) {
    issues.push("eventId must be a UUID");
  }
  if (!event.matchId) {
    issues.push("matchId is required");
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    issues.push("occurredAt must be a valid ISO timestamp");
  }
  if (event.sequence < 0) {
    issues.push("sequence must be >= 0");
  }

  return issues;
}
