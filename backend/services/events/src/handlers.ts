import { replayMatch } from "@hockey-timer/replay-engine";
import { type MatchEvent, sortEvents, validateEvent } from "@hockey-timer/event-schema";
import { authorize } from "./auth.ts";
import { getEvents, listEvents, upsertEvents } from "./store.ts";

type ApiEvent = {
  pathParameters?: { id?: string };
  body?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: { since?: string };
};

type ApiResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const CORS_HEADERS = {
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
};
const JSON_HEADERS = { ...CORS_HEADERS, "content-type": "application/json" };

function json(statusCode: number, payload: object): ApiResult {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

type MatchCatalogItem = {
  id: string;
  source: string;
  createdAt: string;
  matchDateTime?: string;
  homeTeam: string;
  awayTeam: string;
  clubName?: string;
  teamName?: string;
  knhbMatchId?: string;
};

function stringPayload(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function catalogFromEvents(events: MatchEvent[]): MatchCatalogItem[] {
  const byId = new Map<string, MatchCatalogItem>();

  for (const event of sortEvents(events)) {
    if (event.eventType !== "match.created" && event.eventType !== "match.updated") continue;

    const payload = event.payload as Record<string, unknown>;
    const existing = byId.get(event.matchId);
    byId.set(event.matchId, {
      id: event.matchId,
      source: stringPayload(payload, "source") ?? existing?.source ?? "remote",
      createdAt: existing?.createdAt ?? event.occurredAt,
      matchDateTime: stringPayload(payload, "matchDateTime") ?? existing?.matchDateTime,
      homeTeam: stringPayload(payload, "homeTeam") ?? existing?.homeTeam ?? "Home",
      awayTeam: stringPayload(payload, "awayTeam") ?? existing?.awayTeam ?? "Away",
      clubName: stringPayload(payload, "clubName") ?? stringPayload(payload, "location") ?? existing?.clubName,
      teamName: stringPayload(payload, "teamName") ?? existing?.teamName,
      knhbMatchId: stringPayload(payload, "knhbMatchId") ?? existing?.knhbMatchId,
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftDate = left.matchDateTime ?? left.createdAt;
    const rightDate = right.matchDateTime ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function optionsHandler(): ApiResult {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

export async function listMatchesHandler(event: ApiEvent): Promise<ApiResult> {
  const auth = await authorize(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

  return json(200, { matches: catalogFromEvents(listEvents()) });
}

export async function batchUpsertHandler(event: ApiEvent): Promise<ApiResult> {
  const auth = await authorize(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

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
  const auth = await authorize(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

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
  const auth = await authorize(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

  const matchId = event.pathParameters?.id;
  if (!matchId) {
    return json(400, { error: "match id required" });
  }

  const projection = replayMatch(getEvents(matchId), matchId);
  return json(200, projection);
}
