import { replayMatch } from "@hockey-timer/replay-engine";
import { type MatchEvent, sortEvents, validateEvent } from "@hockey-timer/event-schema";
import { getEvents, upsertEvents } from "./store.js";

type ApiEvent = {
  pathParameters?: { id?: string };
  body?: string;
  queryStringParameters?: { since?: string };
};

type ApiResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const JSON_HEADERS = { "content-type": "application/json" };

function json(statusCode: number, payload: object): ApiResult {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

export async function batchUpsertHandler(event: ApiEvent): Promise<ApiResult> {
  const matchId = event.pathParameters?.id;
  if (!matchId) {
    return json(400, { error: "match id required" });
  }

  const parsed = JSON.parse(event.body ?? "{}") as { events?: MatchEvent[] };
  const events = (parsed.events ?? []).filter((item) => item.matchId === matchId);
  const validationErrors = events
    .map((candidate) => ({ eventId: candidate.eventId, issues: validateEvent(candidate) }))
    .filter((x) => x.issues.length > 0);

  if (validationErrors.length > 0) {
    return json(422, { error: "event validation failed", validationErrors });
  }

  const result = upsertEvents(events);
  return json(200, {
    ...result,
    totalKnownEvents: getEvents(matchId).length,
    checkpoint: sortEvents(getEvents(matchId)).at(-1)?.occurredAt,
  });
}

export async function listEventsHandler(event: ApiEvent): Promise<ApiResult> {
  const matchId = event.pathParameters?.id;
  if (!matchId) {
    return json(400, { error: "match id required" });
  }

  const since = event.queryStringParameters?.since;
  const ordered = sortEvents(getEvents(matchId));
  const filtered = since ? ordered.filter((e) => e.occurredAt > since) : ordered;

  return json(200, {
    matchId,
    events: filtered,
    checkpoint: ordered.at(-1)?.occurredAt,
  });
}

export async function projectionHandler(event: ApiEvent): Promise<ApiResult> {
  const matchId = event.pathParameters?.id;
  if (!matchId) {
    return json(400, { error: "match id required" });
  }

  const projection = replayMatch(getEvents(matchId), matchId);
  return json(200, projection);
}
