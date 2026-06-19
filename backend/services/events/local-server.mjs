import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const KNHB_BASE = process.env.KNHB_BASE_URL || "https://app.hockeyweerelt.nl";

let eventStore;
let cachedJwks;
let knhbDevice;

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(base64UrlDecode(value)).toString("utf8"));
}

function audienceMatches(actual, expected) {
  if (!expected) return true;
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

async function getJwks() {
  if (cachedJwks) return cachedJwks;
  if (!process.env.AUTH_JWKS_URL) {
    throw new Error("AUTH_JWKS_URL is required when AUTH_MODE=required");
  }
  const response = await fetch(process.env.AUTH_JWKS_URL);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${response.status}`);
  }
  cachedJwks = await response.json();
  return cachedJwks;
}

async function verifyJwt(token) {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("malformed bearer token");

  const header = decodeJwtPart(headerPart);
  const payload = decodeJwtPart(payloadPart);
  if (header.alg !== "RS256") throw new Error("unsupported token algorithm");

  const jwks = await getJwks();
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!key?.n || !key?.e) throw new Error("matching JWKS key not found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, base64UrlDecode(signaturePart), signed);
  if (!valid) throw new Error("invalid token signature");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.sub) throw new Error("token subject required");
  if (payload.exp && payload.exp <= nowSeconds) throw new Error("token expired");
  if (process.env.AUTH_ISSUER && payload.iss !== process.env.AUTH_ISSUER) throw new Error("token issuer mismatch");
  if (!audienceMatches(payload.aud, process.env.AUTH_AUDIENCE)) throw new Error("token audience mismatch");
}

async function authorizeRequest(req) {
  if (process.env.AUTH_MODE !== "required") {
    return { ok: true };
  }

  const header = req.headers.authorization || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { ok: false, error: "authentication required" };
  }

  if (process.env.AUTH_DEV_BEARER_TOKEN && token === process.env.AUTH_DEV_BEARER_TOKEN) {
    return { ok: true };
  }

  try {
    await verifyJwt(token);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

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

function stringPayload(payload, key) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function catalogFromEvents(events) {
  const byId = new Map();
  for (const event of sortEvents(events)) {
    if (event.eventType !== "match.created" && event.eventType !== "match.updated") continue;

    const payload = event.payload || {};
    const existing = byId.get(event.matchId);
    byId.set(event.matchId, {
      id: event.matchId,
      source: stringPayload(payload, "source") || existing?.source || "remote",
      createdAt: existing?.createdAt || event.occurredAt,
      matchDateTime: stringPayload(payload, "matchDateTime") || existing?.matchDateTime,
      homeTeam: stringPayload(payload, "homeTeam") || existing?.homeTeam || "Home",
      awayTeam: stringPayload(payload, "awayTeam") || existing?.awayTeam || "Away",
      clubName: stringPayload(payload, "clubName") || stringPayload(payload, "location") || existing?.clubName,
      teamName: stringPayload(payload, "teamName") || existing?.teamName,
      knhbMatchId: stringPayload(payload, "knhbMatchId") || existing?.knhbMatchId,
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftDate = left.matchDateTime || left.createdAt;
    const rightDate = right.matchDateTime || right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

async function createSqliteStore() {
  const sqlitePath = process.env.SQLITE_PATH || "data/hockey-timer.sqlite";
  await mkdir(dirname(sqlitePath), { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_events (
      event_id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      origin_device_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      event_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_match_events_match_order
      ON match_events (match_id, occurred_at, origin_device_id, sequence);
  `);

  const insert = db.prepare(`
    INSERT INTO match_events (event_id, match_id, occurred_at, origin_device_id, sequence, event_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const selectByMatch = db.prepare(`
    SELECT event_json
    FROM match_events
    WHERE match_id = ?
    ORDER BY occurred_at, origin_device_id, sequence
  `);

  return {
    async upsertEvents(events) {
      let inserted = 0;
      let duplicates = 0;
      for (const event of events) {
        try {
          insert.run(
            event.eventId,
            event.matchId,
            event.occurredAt,
            event.originDeviceId || "",
            Number(event.sequence || 0),
            JSON.stringify(event),
          );
          inserted += 1;
        } catch (error) {
          if (String(error?.message || "").includes("UNIQUE constraint failed")) {
            duplicates += 1;
            continue;
          }
          throw error;
        }
      }
      return { inserted, duplicates };
    },
    async getEvents(matchId) {
      return selectByMatch.all(matchId).map((row) => JSON.parse(row.event_json));
    },
    async listEvents() {
      return db.prepare(`
        SELECT event_json
        FROM match_events
        ORDER BY occurred_at, origin_device_id, sequence
      `).all().map((row) => JSON.parse(row.event_json));
    },
  };
}

async function createPostgresStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required when STORAGE_DRIVER=postgres");

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_events (
      event_id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      origin_device_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      event_json JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_match_events_match_order
      ON match_events (match_id, occurred_at, origin_device_id, sequence);
  `);

  return {
    async upsertEvents(events) {
      let inserted = 0;
      let duplicates = 0;
      for (const event of events) {
        const result = await pool.query(
          `
            INSERT INTO match_events (event_id, match_id, occurred_at, origin_device_id, sequence, event_json)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING event_id
          `,
          [
            event.eventId,
            event.matchId,
            event.occurredAt,
            event.originDeviceId || "",
            Number(event.sequence || 0),
            JSON.stringify(event),
          ],
        );
        if (result.rowCount === 1) inserted += 1;
        else duplicates += 1;
      }
      return { inserted, duplicates };
    },
    async getEvents(matchId) {
      const result = await pool.query(
        `
          SELECT event_json
          FROM match_events
          WHERE match_id = $1
          ORDER BY occurred_at, origin_device_id, sequence
        `,
        [matchId],
      );
      return result.rows.map((row) => row.event_json);
    },
    async listEvents() {
      const result = await pool.query(`
        SELECT event_json
        FROM match_events
        ORDER BY occurred_at, origin_device_id, sequence
      `);
      return result.rows.map((row) => row.event_json);
    },
  };
}

async function createEventStore() {
  const driver = process.env.STORAGE_DRIVER || "sqlite";
  if (driver === "sqlite") return createSqliteStore();
  if (driver === "postgres") return createPostgresStore();
  throw new Error(`unsupported STORAGE_DRIVER: ${driver}`);
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
    "access-control-allow-headers": "authorization,content-type",
  });
  res.end(JSON.stringify(payload));
}

async function proxyKnhbJson(res, path) {
  const target = `${KNHB_BASE}${path}`;
  try {
    let response = await fetchWithRedirectGuard(target, {
      headers: await knhbRequestHeaders(target),
    });
    if (response.status === 401) {
      knhbDevice = undefined;
      response = await fetchWithRedirectGuard(target, {
        headers: await knhbRequestHeaders(target),
      });
    }

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    res.writeHead(response.status, {
      "content-type": contentType,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: "knhb proxy failed",
      details: String(error),
      target,
    });
  }
}

async function knhbRequestHeaders(target) {
  const device = await getKnhbDevice();
  const url = new URL(target);
  const path = url.pathname.replace(/[^a-zA-Z0-9\-/]+/g, "");
  const query = Array.from(url.searchParams.entries())
    .filter(([key]) => key.length > 0)
    .map(([key, value]) => {
      const cleanKey = key.replace(/[^a-zA-Z0-9\-/=]+/g, "");
      const cleanValue = value.replace(/[^a-zA-Z0-9\-/=]+/g, "");
      return `${cleanKey}=${cleanValue}`;
    })
    .join("");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = device.uuid.split("").reverse().join("");
  const signature = createHash("sha1").update(`${timestamp}${path}${query}${secret}`).digest("hex");
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-requested-with": "XMLHttpRequest",
    "x-hapi-authorization": device.token,
    "x-hapi-timestamp": timestamp,
    "x-hapi-signature": signature,
    "x-hapi-version": "7",
  };
}

async function getKnhbDevice() {
  if (knhbDevice) return knhbDevice;

  const uuid = process.env.KNHB_DEVICE_UUID || randomUUID();
  const target = new URL("/device/register", KNHB_BASE).toString();
  const response = await fetchWithRedirectGuard(target, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify({ uuid, os: "Web" }),
  });
  if (!response.ok) {
    throw new Error(`knhb device registration failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.token) {
    throw new Error("knhb device registration returned no token");
  }
  knhbDevice = { uuid, token: payload.token };
  return knhbDevice;
}

async function fetchWithRedirectGuard(target, options = {}) {
  let current = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(current, {
      ...options,
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    const next = new URL(location, current).toString();
    if (next === current) {
      throw new Error(`knhb upstream redirect loop: ${current}`);
    }
    current = next;
  }

  throw new Error(`knhb upstream too many redirects: ${target}`);
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
      "access-control-allow-headers": "authorization,content-type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const matchesRoute = url.pathname === "/matches";
  const upsertMatch = url.pathname.match(/^\/matches\/([^/]+)\/events:batchUpsert$/);
  const eventsMatch = url.pathname.match(/^\/matches\/([^/]+)\/events$/);
  const projectionMatch = url.pathname.match(/^\/matches\/([^/]+)\/projection$/);
  const knhbClubsMatch = url.pathname.match(/^\/knhb\/clubs$/);
  const knhbTeamsMatch = url.pathname.match(/^\/knhb\/clubs\/([^/]+)\/teams$/);
  const knhbUpcomingMatch = url.pathname.match(/^\/knhb\/teams\/([^/]+)\/matches\/upcoming$/);
  const knhbOfficialMatch = url.pathname.match(/^\/knhb\/teams\/([^/]+)\/matches\/official$/);
  const isApiRoute =
    matchesRoute ||
    upsertMatch ||
    eventsMatch ||
    projectionMatch ||
    knhbClubsMatch ||
    knhbTeamsMatch ||
    knhbUpcomingMatch ||
    knhbOfficialMatch;

  if (isApiRoute) {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      sendJson(res, 401, { error: auth.error });
      return;
    }
  }

  if (req.method === "GET" && matchesRoute) {
    sendJson(res, 200, { matches: catalogFromEvents(await eventStore.listEvents()) });
    return;
  }

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

    const result = await eventStore.upsertEvents(events);
    const ordered = sortEvents(await eventStore.getEvents(matchId));
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
    const ordered = sortEvents(await eventStore.getEvents(matchId));
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
    const projection = replayMatch(await eventStore.getEvents(matchId), matchId);
    sendJson(res, 200, projection);
    return;
  }

  if (req.method === "GET" && knhbClubsMatch) {
    await proxyKnhbJson(res, "/clubs");
    return;
  }

  if (req.method === "GET" && knhbTeamsMatch) {
    const clubId = encodeURIComponent(decodeURIComponent(knhbTeamsMatch[1]));
    await proxyKnhbJson(res, `/clubs/${clubId}/teams`);
    return;
  }

  if (req.method === "GET" && knhbUpcomingMatch) {
    const teamId = encodeURIComponent(decodeURIComponent(knhbUpcomingMatch[1]));
    await proxyKnhbJson(res, `/teams/${teamId}/matches/upcoming`);
    return;
  }

  if (req.method === "GET" && knhbOfficialMatch) {
    const teamId = encodeURIComponent(decodeURIComponent(knhbOfficialMatch[1]));
    await proxyKnhbJson(res, `/teams/${teamId}/matches/official`);
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

eventStore = await createEventStore();

server.listen(PORT, () => {
  console.log(`events service listening on http://localhost:${PORT}`);
});
