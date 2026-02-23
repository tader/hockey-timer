import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);

const eventsByMatch = new Map();
const seenEventIds = new Set();

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt.localeCompare(b.occurredAt);
    const ak = `${a.originDeviceId}:${String(a.sequence).padStart(12, "0")}`;
    const bk = `${b.originDeviceId}:${String(b.sequence).padStart(12, "0")}`;
    return ak.localeCompare(bk);
  });
}

function replayMatch(events, matchId) {
  const ordered = sortEvents(events.filter((event) => event.matchId === matchId));
  let homeScore = 0;
  let awayScore = 0;
  let isRunning = false;
  let isEnded = false;
  let currentPeriod = 1;
  let totalPlayedSeconds = 0;
  let currentPeriodPlayedSeconds = 0;
  let runningFrom = null;
  let format = { periodCount: 4, periodDurationSeconds: [1050, 1050, 1050, 1050] };

  for (const event of ordered) {
    const occurredAt = new Date(event.occurredAt);

    if (event.eventType === "score.changed") {
      if (event.payload?.team === "home") homeScore += Number(event.payload?.delta || 0);
      if (event.payload?.team === "away") awayScore += Number(event.payload?.delta || 0);
    }

    if (event.eventType === "match.format.updated") {
      format = {
        periodCount: Number(event.payload?.periodCount || format.periodCount),
        periodDurationSeconds: Array.isArray(event.payload?.periodDurationSeconds)
          ? event.payload.periodDurationSeconds
          : format.periodDurationSeconds,
      };
    }

    if (event.eventType === "match.started" || event.eventType === "match.resumed") {
      if (isEnded) continue;
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
      currentPeriod = Number(event.payload?.period || currentPeriod);
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

function validateEvent(event) {
  const issues = [];
  if (!isUuid(event.eventId || "")) issues.push("eventId must be a UUID");
  if (!event.matchId) issues.push("matchId is required");
  if (Number.isNaN(Date.parse(event.occurredAt))) issues.push("occurredAt must be valid ISO timestamp");
  if (typeof event.sequence !== "number" || event.sequence < 0) issues.push("sequence must be >= 0");
  return issues;
}

function upsertEvents(events) {
  let inserted = 0;
  let duplicates = 0;
  for (const event of events) {
    if (seenEventIds.has(event.eventId)) {
      duplicates += 1;
      continue;
    }
    seenEventIds.add(event.eventId);
    const current = eventsByMatch.get(event.matchId) || [];
    current.push(event);
    eventsByMatch.set(event.matchId, current);
    inserted += 1;
  }
  return { inserted, duplicates };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: "bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const upsertMatch = url.pathname.match(/^\/matches\/([^/]+)\/events:batchUpsert$/);
  const eventsMatch = url.pathname.match(/^\/matches\/([^/]+)\/events$/);
  const projectionMatch = url.pathname.match(/^\/matches\/([^/]+)\/projection$/);

  if (req.method === "POST" && upsertMatch) {
    const matchId = decodeURIComponent(upsertMatch[1]);
    const body = await readJson(req);
    const events = (body.events || []).filter((item) => item.matchId === matchId);
    const validationErrors = events
      .map((candidate) => ({ eventId: candidate.eventId, issues: validateEvent(candidate) }))
      .filter((x) => x.issues.length > 0);

    if (validationErrors.length > 0) {
      sendJson(res, 422, { error: "event validation failed", validationErrors });
      return;
    }

    const result = upsertEvents(events);
    const ordered = sortEvents(eventsByMatch.get(matchId) || []);
    sendJson(res, 200, {
      ...result,
      totalKnownEvents: ordered.length,
      checkpoint: ordered.at(-1)?.occurredAt,
    });
    return;
  }

  if (req.method === "GET" && eventsMatch) {
    const matchId = decodeURIComponent(eventsMatch[1]);
    const since = url.searchParams.get("since") || undefined;
    const ordered = sortEvents(eventsByMatch.get(matchId) || []);
    const filtered = since ? ordered.filter((item) => item.occurredAt > since) : ordered;
    sendJson(res, 200, {
      matchId,
      events: filtered,
      checkpoint: ordered.at(-1)?.occurredAt,
    });
    return;
  }

  if (req.method === "GET" && projectionMatch) {
    const matchId = decodeURIComponent(projectionMatch[1]);
    const projection = replayMatch(eventsByMatch.get(matchId) || [], matchId);
    sendJson(res, 200, projection);
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`events service listening on http://localhost:${PORT}`);
});
