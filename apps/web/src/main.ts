import {
  firstString,
  parseKNHBMatchItem,
  toImportedMatchMetadata,
} from "./knhb-parsing.js";

type RuntimeConfig = {
  __API_BASE__?: string;
  __AUTH_AUTHORIZATION_ENDPOINT__?: string;
  __AUTH_AUDIENCE__?: string;
  __AUTH_CLIENT_ID__?: string;
  __AUTH_ISSUER__?: string;
  __AUTH_REDIRECT_URI__?: string;
  __AUTH_SCOPE__?: string;
  __AUTH_TOKEN_ENDPOINT__?: string;
};

const runtimeConfig = globalThis as RuntimeConfig;
const API_BASE = runtimeConfig.__API_BASE__ ?? "http://localhost:8787";
const AUTH_AUTHORIZATION_ENDPOINT = runtimeConfig.__AUTH_AUTHORIZATION_ENDPOINT__ ?? "";
const AUTH_AUDIENCE = runtimeConfig.__AUTH_AUDIENCE__ ?? "";
const AUTH_CLIENT_ID = runtimeConfig.__AUTH_CLIENT_ID__ ?? "";
const AUTH_ISSUER = runtimeConfig.__AUTH_ISSUER__ ?? "";
const AUTH_REDIRECT_URI = runtimeConfig.__AUTH_REDIRECT_URI__ ?? globalThis.location.origin;
const AUTH_SCOPE = runtimeConfig.__AUTH_SCOPE__ ?? "openid profile email";
const AUTH_TOKEN_ENDPOINT = runtimeConfig.__AUTH_TOKEN_ENDPOINT__ ?? "";
const KNHB_BASE = `${API_BASE}/knhb`;
const matchesKey = "hockey_timer_web_matches";
const selectedMatchIdKey = "hockey_timer_web_selected_match";
const deviceIdKey = "hockey_timer_web_device_id";
const sequenceKey = "hockey_timer_web_sequence";
const favoriteTeamsKey = "hockey_timer_web_favorite_teams";
const authStateKey = "hockey_timer_web_auth_state";
const authPkceVerifierKey = "hockey_timer_web_pkce_verifier";
const authStateNonceKey = "hockey_timer_web_auth_nonce";

type AuthState = {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  tokenType: string;
};

type MatchEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
  originDeviceId?: string;
  originPlatform?: string;
  sequence?: number;
};

type MatchScore = {
  homeScore: number;
  awayScore: number;
};

type MatchMetadata = {
  id: string;
  source: "web-custom" | "knhb" | "local";
  createdAt: string;
  matchDateTime?: string;
  homeTeam: string;
  awayTeam: string;
  locationClubName?: string;
  fieldName?: string;
  knhbMatchId?: string;
  knhbSourceTeamId?: string;
};

type KNHBOption = {
  id: string;
  name: string;
  subtitle?: string;
  abbreviation?: string;
};

type KNHBMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  dateRaw?: string;
  locationClubName?: string;
  fieldName?: string;
  sourceTeamIds?: string[];
};

type FavoriteTeam = {
  key: string;
  clubId: string;
  clubName?: string;
  name: string;
  teamIds: string[];
};

type UIState = {
  matches: MatchMetadata[];
  selectedMatchId: string;
  output: string;
  loading: boolean;
  clubs: KNHBOption[];
  teams: KNHBOption[];
  foundMatches: KNHBMatch[];
  selectedClubId: string;
  selectedTeamId: string;
  clubQuery: string;
  favoriteTeams: FavoriteTeam[];
  activeFavoriteKey?: string;
  events: MatchEvent[];
  view: "list" | "match" | "create";
  createMode: "knhb" | "custom";
  importTarget: "new" | "update";
  importTargetMatchId?: string;
  sortField: "homeTeam" | "awayTeam" | "matchDateTime" | "locationClubName" | "fieldName" | "source" | "createdAt";
  sortDirection: "asc" | "desc";
  filterHome: string;
  filterAway: string;
  filterTeam: string;
  filterClub: string;
  filterField: string;
  filterSource: "all" | "web-custom" | "knhb" | "local";
  liveNowMs: number;
  listScores: Record<string, MatchScore>;
  listScoresRefreshing: boolean;
  matchMenuOpen: boolean;
  metadataModalOpen: boolean;
  showEventStream: boolean;
  scoreboardMode: boolean;
  showShortcutsModal: boolean;
  auth: AuthState | null;
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("missing #app");
}
const appRoot: HTMLDivElement = root;

function authConfigured(): boolean {
  return !!AUTH_AUTHORIZATION_ENDPOINT && !!AUTH_CLIENT_ID && !!AUTH_TOKEN_ENDPOINT;
}

function loadAuthState(): AuthState | null {
  const raw = localStorage.getItem(authStateKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(authStateKey);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(authStateKey);
    return null;
  }
}

function saveAuthState(auth: AuthState): void {
  localStorage.setItem(authStateKey, JSON.stringify(auth));
  uiState.auth = auth;
}

function clearAuthState(): void {
  localStorage.removeItem(authStateKey);
  localStorage.removeItem(authPkceVerifierKey);
  localStorage.removeItem(authStateNonceKey);
  uiState.auth = null;
}

function base64UrlEncode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function randomBase64Url(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer);
}

async function beginSignIn(): Promise<void> {
  if (!authConfigured()) {
    uiState.output = "Authentication is not configured.";
    render();
    return;
  }

  const verifier = randomBase64Url(32);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomBase64Url(16);
  localStorage.setItem(authPkceVerifierKey, verifier);
  localStorage.setItem(authStateNonceKey, state);

  const url = new URL(AUTH_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", AUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", AUTH_REDIRECT_URI);
  url.searchParams.set("scope", AUTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (AUTH_AUDIENCE) {
    url.searchParams.set("audience", AUTH_AUDIENCE);
  }
  window.location.assign(url.toString());
}

async function completeAuthRedirect(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return;

  const expectedState = localStorage.getItem(authStateNonceKey);
  const verifier = localStorage.getItem(authPkceVerifierKey);
  localStorage.removeItem(authStateNonceKey);
  localStorage.removeItem(authPkceVerifierKey);

  if (!state || state !== expectedState || !verifier) {
    uiState.output = "Sign-in callback rejected.";
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: AUTH_CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: AUTH_REDIRECT_URI,
  });
  const response = await fetch(AUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    uiState.output = `Sign-in failed: ${response.status}`;
    return;
  }

  const token = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    id_token?: string;
    token_type?: string;
  };
  if (!token.access_token) {
    uiState.output = "Sign-in failed: token missing.";
    return;
  }
  saveAuthState({
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
    idToken: token.id_token,
    tokenType: token.token_type ?? "Bearer",
  });
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, document.title, url.toString());
  uiState.output = "Signed in.";
}

function authHeaders(): Record<string, string> {
  if (!authConfigured()) {
    throw new Error("Authentication is not configured for web API access.");
  }
  uiState.auth = loadAuthState();
  if (!uiState.auth) {
    throw new Error("Sign in required for web API access.");
  }
  return { authorization: `${uiState.auth.tokenType} ${uiState.auth.accessToken}` };
}

function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

const uiState: UIState = {
  matches: loadMatches(),
  selectedMatchId: "",
  output: "Ready.",
  loading: false,
  clubs: [],
  teams: [],
  foundMatches: [],
  selectedClubId: "",
  selectedTeamId: "",
  clubQuery: "",
  favoriteTeams: loadFavoriteTeams(),
  activeFavoriteKey: undefined,
  events: [],
  view: "list",
  createMode: "knhb",
  importTarget: "new",
  importTargetMatchId: undefined,
  sortField: "matchDateTime",
  sortDirection: "desc",
  filterHome: "",
  filterAway: "",
  filterTeam: "",
  filterClub: "",
  filterField: "",
  filterSource: "all",
  liveNowMs: Date.now(),
  listScores: {},
  listScoresRefreshing: false,
  matchMenuOpen: false,
  metadataModalOpen: false,
  showEventStream: true,
  scoreboardMode: false,
  showShortcutsModal: false,
  auth: loadAuthState(),
};

if (uiState.matches.length === 0) {
  const demo: MatchMetadata = {
    id: "demo-match",
    source: "local",
    createdAt: new Date().toISOString(),
    matchDateTime: new Date().toISOString(),
    homeTeam: "Home",
    awayTeam: "Away",
    locationClubName: "Demo Club",
    fieldName: "Field 1",
  };
  uiState.matches = [demo];
  saveMatches(uiState.matches);
}

const persistedSelected = localStorage.getItem(selectedMatchIdKey);
uiState.selectedMatchId =
  persistedSelected && uiState.matches.some((match) => match.id === persistedSelected)
    ? persistedSelected
    : uiState.matches[0]?.id ?? "";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function matchTitle(match: MatchMetadata): string {
  return `${match.homeTeam} – ${match.awayTeam}`;
}

function matchSubtitle(match: MatchMetadata): string {
  const parts: string[] = [];
  if (match.matchDateTime) {
    const formatted = formatAmsterdamDate(match.matchDateTime);
    if (formatted) {
      parts.push(formatted);
    }
  }
  if (match.locationClubName) {
    parts.push(match.locationClubName);
  }
  if (match.fieldName) {
    parts.push(match.fieldName);
  }
  return parts.join(" • ");
}

function sortedMatches(matches: MatchMetadata[]): MatchMetadata[] {
  return [...matches].sort((left, right) => {
    const leftDate = Date.parse(left.matchDateTime ?? left.createdAt);
    const rightDate = Date.parse(right.matchDateTime ?? right.createdAt);
    return rightDate - leftDate;
  });
}

function getSelectedMatch(): MatchMetadata | undefined {
  return uiState.matches.find((match) => match.id === uiState.selectedMatchId);
}

function getDeviceId(): string {
  const current = localStorage.getItem(deviceIdKey);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(deviceIdKey, created);
  return created;
}

function nextSequence(): number {
  const current = Number(localStorage.getItem(sequenceKey) ?? "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(sequenceKey, String(next));
  return next;
}

function loadMatches(): MatchMetadata[] {
  const raw = localStorage.getItem(matchesKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized: MatchMetadata[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") {
        continue;
      }
      const raw = item as Record<string, unknown>;
      normalized.push({
        id: String(raw.id),
        source: (raw.source === "web-custom" || raw.source === "knhb" || raw.source === "local")
          ? raw.source
          : "local",
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
        matchDateTime: typeof raw.matchDateTime === "string" ? raw.matchDateTime : undefined,
        homeTeam: typeof raw.homeTeam === "string" ? raw.homeTeam : "Home",
        awayTeam: typeof raw.awayTeam === "string" ? raw.awayTeam : "Away",
        locationClubName: typeof raw.locationClubName === "string"
          ? raw.locationClubName
          : typeof raw.clubName === "string"
            ? raw.clubName
            : undefined,
        fieldName: typeof raw.fieldName === "string"
          ? raw.fieldName
          : typeof raw.teamName === "string"
            ? raw.teamName
            : undefined,
        knhbMatchId: typeof raw.knhbMatchId === "string" ? raw.knhbMatchId : undefined,
        knhbSourceTeamId: typeof raw.knhbSourceTeamId === "string"
          ? raw.knhbSourceTeamId
          : typeof raw.knhbTeamId === "string"
            ? raw.knhbTeamId
            : undefined,
      });
    }
    return normalized;
  } catch {
    return [];
  }
}

function saveMatches(matches: MatchMetadata[]): void {
  localStorage.setItem(matchesKey, JSON.stringify(matches));
}

function loadFavoriteTeams(): FavoriteTeam[] {
  const raw = localStorage.getItem(favoriteTeamsKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized: FavoriteTeam[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      // Backward compatibility for older favorite payloads keyed by team id.
      const legacyId = typeof record.id === "string" ? record.id : undefined;
      const key = typeof record.key === "string" ? record.key : legacyId;
      const clubId = typeof record.clubId === "string" ? record.clubId : "";
      const name = typeof record.name === "string" ? record.name : "";
      if (!key || !name) continue;
      const teamIds = Array.isArray(record.teamIds)
        ? record.teamIds.filter((value): value is string => typeof value === "string")
        : legacyId
          ? [legacyId]
          : [];
      normalized.push({
        key,
        clubId,
        clubName: typeof record.clubName === "string" ? record.clubName : undefined,
        name,
        teamIds,
      });
    }
    return normalized;
  } catch {
    return [];
  }
}

function saveFavoriteTeams(favoriteTeams: FavoriteTeam[]): void {
  localStorage.setItem(favoriteTeamsKey, JSON.stringify(favoriteTeams));
}

function normalizeTeamName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function favoriteTeamKey(clubId: string, teamName: string): string {
  return `${clubId}::${normalizeTeamName(teamName)}`;
}

function isFavoriteTeamKey(key: string): boolean {
  return uiState.favoriteTeams.some((team) => team.key === key);
}

function addFavoriteTeam(team: FavoriteTeam): void {
  const existing = uiState.favoriteTeams.find((current) => current.key === team.key);
  if (existing) {
    existing.teamIds = Array.from(new Set([...existing.teamIds, ...team.teamIds]));
    if (!existing.clubName && team.clubName) existing.clubName = team.clubName;
    saveFavoriteTeams(uiState.favoriteTeams);
    return;
  }
  uiState.favoriteTeams = [...uiState.favoriteTeams, team];
  saveFavoriteTeams(uiState.favoriteTeams);
}

function removeFavoriteTeam(favoriteKey: string): void {
  uiState.favoriteTeams = uiState.favoriteTeams.filter((team) => team.key !== favoriteKey);
  saveFavoriteTeams(uiState.favoriteTeams);
}

function upsertMatch(match: MatchMetadata): void {
  const index = uiState.matches.findIndex((current) => current.id === match.id);
  if (index >= 0) {
    uiState.matches[index] = match;
  } else {
    uiState.matches.push(match);
  }
  saveMatches(uiState.matches);
}

function createQuickMatch(): MatchMetadata {
  const now = new Date().toISOString();
  return {
    id: `quick-${crypto.randomUUID().toLowerCase()}`,
    source: "web-custom",
    createdAt: now,
    matchDateTime: now,
    homeTeam: "Home",
    awayTeam: "Away",
    locationClubName: undefined,
    fieldName: undefined,
  };
}

function metadataPayload(match: MatchMetadata): Record<string, unknown> {
  return {
    source: match.source,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchDateTime: match.matchDateTime ?? null,
    location: match.locationClubName ?? null,
    fieldName: match.fieldName ?? null,
    knhbMatchId: match.knhbMatchId ?? null,
    knhbSourceTeamId: match.knhbSourceTeamId ?? null,
  };
}

async function emitMatchMetadataEvent(
  matchId: string,
  eventType: "match.created" | "match.updated",
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await pushEvent(matchId, eventType, payload);
    if (uiState.selectedMatchId === matchId && uiState.view === "match") {
      await refreshProjection();
    }
  } catch {
    // Keep local metadata updates resilient even when event transport is unavailable.
  }
}

async function emitMatchFormatEvent(
  matchId: string,
  periodCount: number,
  periodDurationSeconds: number[],
): Promise<void> {
  try {
    await pushEvent(matchId, "match.format.updated", { periodCount, periodDurationSeconds });
    if (uiState.selectedMatchId === matchId && uiState.view === "match") {
      await refreshProjection();
    }
  } catch {
    // Keep format updates resilient even when event transport is unavailable.
  }
}

async function applyImportedMatch(selected: KNHBMatch, options?: { forceUpdateMatchId?: string }): Promise<void> {
  const selectedClub = uiState.clubs.find((club) => club.id === uiState.selectedClubId);
  const importSourceTeamId = selected.sourceTeamIds?.[0] ?? uiState.selectedTeamId ?? undefined;
  const base = toImportedMatchMetadata(selected, {
    nowIso: new Date().toISOString(),
    parsedDateIso: parsePossibleDate(selected.dateRaw),
    selectedClubName: selectedClub?.abbreviation ?? selectedClub?.name,
  });
  let updatedMatch: MatchMetadata | undefined;
  let created = false;

  const updateTargetId = options?.forceUpdateMatchId ?? (uiState.importTarget === "update" ? uiState.importTargetMatchId : undefined);
  if (updateTargetId) {
    const existing = uiState.matches.find((item) => item.id === updateTargetId);
    if (existing) {
      updatedMatch = {
        ...existing,
        source: "knhb",
        homeTeam: base.homeTeam,
        awayTeam: base.awayTeam,
        matchDateTime: base.matchDateTime,
        locationClubName: base.locationClubName,
        fieldName: base.fieldName,
        knhbMatchId: base.knhbMatchId,
        knhbSourceTeamId: importSourceTeamId ?? existing.knhbSourceTeamId,
      };
      upsertMatch(updatedMatch);
      uiState.selectedMatchId = existing.id;
    }
  } else {
    updatedMatch = { ...base, knhbSourceTeamId: importSourceTeamId };
    upsertMatch(updatedMatch);
    created = true;
    uiState.selectedMatchId = base.id;
  }

  localStorage.setItem(selectedMatchIdKey, uiState.selectedMatchId);
  uiState.events = [];
  uiState.view = "match";
  uiState.matchMenuOpen = false;
  uiState.metadataModalOpen = false;
  uiState.output = "KNHB metadata applied.";
  if (updatedMatch) {
    await emitMatchMetadataEvent(
      updatedMatch.id,
      created ? "match.created" : "match.updated",
      metadataPayload(updatedMatch),
    );
  }
}

async function pushEvent(matchId: string, eventType: string, payload: object): Promise<void> {
  const event = {
    eventId: crypto.randomUUID(),
    matchId,
    eventType,
    occurredAt: new Date().toISOString(),
    originDeviceId: getDeviceId(),
    originPlatform: "web",
    sequence: nextSequence(),
    payload,
    version: 1,
  };

  const response = await authFetch(`${API_BASE}/matches/${matchId}/events:batchUpsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [event] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upsert failed: ${response.status} ${text}`);
  }
}

async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  const response = await authFetch(`${API_BASE}/matches/${matchId}/events`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`events fetch failed: ${response.status} ${text}`);
  }
  const payload = (await response.json()) as { events?: MatchEvent[] };
  return payload.events ?? [];
}

async function fetchProjectionSummary(matchId: string): Promise<MatchScore> {
  const response = await authFetch(`${API_BASE}/matches/${matchId}/projection`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`projection fetch failed: ${response.status} ${text}`);
  }
  const payload = (await response.json()) as { homeScore?: number; awayScore?: number };
  return {
    homeScore: Number(payload.homeScore ?? 0),
    awayScore: Number(payload.awayScore ?? 0),
  };
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function refreshProjection(): Promise<void> {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch) return;
  const targetMatchId = selectedMatch.id;
  try {
    const events = await fetchEvents(targetMatchId);
    if (uiState.selectedMatchId !== targetMatchId) {
      return;
    }
    uiState.events = events;
    const lastEventAt = events.at(-1)?.occurredAt ?? "none";
    uiState.output = `Last update: ${new Date().toLocaleTimeString()} (event: ${lastEventAt})`;
    syncLivePanel();
  } catch (error) {
    uiState.output = (error as Error).message;
    syncLivePanel();
  }
}

async function refreshListScores(): Promise<void> {
  if (uiState.view !== "list" || uiState.listScoresRefreshing) return;
  uiState.listScoresRefreshing = true;
  try {
    const ids = filteredSortedMatches().map((match) => match.id);
    if (ids.length === 0) return;
    const fetched = await Promise.all(
      ids.map(async (id) => {
        try {
          const score = await fetchProjectionSummary(id);
          return [id, score] as const;
        } catch {
          return undefined;
        }
      }),
    );
    let changed = false;
    for (const item of fetched) {
      if (!item) continue;
      const [id, score] = item;
      const current = uiState.listScores[id];
      if (!current || current.homeScore !== score.homeScore || current.awayScore !== score.awayScore) {
        uiState.listScores[id] = score;
        changed = true;
      }
    }
    if (changed && uiState.view === "list") {
      render();
    }
  } finally {
    uiState.listScoresRefreshing = false;
  }
}

function parsePossibleDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    if (numeric > 10_000_000_000) return new Date(numeric).toISOString();
    if (numeric > 1_000_000_000) return new Date(numeric * 1000).toISOString();
  }

  const isoParsed = new Date(trimmed);
  if (!Number.isNaN(isoParsed.valueOf())) {
    return isoParsed.toISOString();
  }

  const candidate = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (candidate) {
    const [, dd, mm, yyyy, hh, min, sec] = candidate;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      sec ? Number(sec) : 0,
    );
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }

  return undefined;
}

function formatAmsterdamDate(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;

  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const day = lookup.get("day") ?? "00";
  const month = lookup.get("month") ?? "00";
  const year = lookup.get("year") ?? "0000";
  return `${day}-${month}-${year}`;
}

function formatAmsterdamDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get("day") ?? "00"}-${lookup.get("month") ?? "00"}-${lookup.get("year") ?? "0000"} ${lookup.get("hour") ?? "00"}:${lookup.get("minute") ?? "00"}:${lookup.get("second") ?? "00"}`;
}

function formatForDateTimeLocal(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}T${lookup.get("hour")}:${lookup.get("minute")}`;
}

function summarizePayload(payload?: Record<string, unknown>): string {
  if (!payload) return "";
  const entries = Object.entries(payload);
  if (entries.length === 0) return "";
  const compact = entries
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function hasMatchStarted(events: MatchEvent[]): boolean {
  return events.some((event) => (
    event.eventType === "match.started" ||
    event.eventType === "match.resumed" ||
    event.eventType === "match.paused" ||
    event.eventType === "match.ended"
  ));
}

function parsePeriodConfig(periodCountRaw: string, periodMinutesRaw: string): { periodCount: number; periodDurationSeconds: number[] } {
  const parsedCount = Number(periodCountRaw);
  const parsedMinutes = Number(periodMinutesRaw);
  const periodCount = Math.max(1, Math.min(12, Number.isFinite(parsedCount) ? Math.round(parsedCount) : 4));
  const periodMinutes = Math.max(1, Math.min(60, Number.isFinite(parsedMinutes) ? parsedMinutes : 17.5));
  const durationSeconds = Math.round(periodMinutes * 60);
  return {
    periodCount,
    periodDurationSeconds: Array.from({ length: periodCount }, () => durationSeconds),
  };
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function periodUnit(periodCount: number): "Half" | "Quarter" | "Period" {
  if (periodCount === 2) return "Half";
  if (periodCount === 4) return "Quarter";
  return "Period";
}

function periodLabel(period: number, periodCount: number): string {
  const unit = periodUnit(periodCount);
  return `${ordinal(period)} ${unit}`;
}

function primaryClockControlState(local: LocalProjection, events: MatchEvent[]): {
  action?: "start" | "pause" | "resume";
  label: string;
  hotkey: string;
  cssClass: "danger" | "neutral-action";
  canEndMatch: boolean;
  canResetClock: boolean;
} {
  const matchStarted = hasMatchStarted(events);
  const action = local.isEnded ? undefined : local.isRunning ? "pause" : matchStarted ? "resume" : "start";
  const label = local.isEnded ? "Match Ended" : local.isRunning ? "Pause" : matchStarted ? "Resume" : "Start";
  const hotkey = local.isRunning || matchStarted ? "Space" : "S";
  const cssClass = local.isRunning ? "danger" : "neutral-action";
  const canEndMatch = !local.isRunning && !local.isEnded && matchStarted;
  const canResetClock = !local.isRunning && !local.isEnded && local.currentPeriodPlayedSeconds > 0;
  return { action, label, hotkey, cssClass, canEndMatch, canResetClock };
}

function renderEventsList(): string {
  if (uiState.events.length === 0) {
    return `<div class="muted">No events yet</div>`;
  }
  const rows = [...uiState.events]
    .reverse()
    .map((event) => {
      const payload = summarizePayload(event.payload);
      return `
        <tr>
          <td><strong>${escapeHtml(event.eventType)}</strong></td>
          <td class="muted">${escapeHtml(formatAmsterdamDateTime(event.occurredAt))}</td>
          <td class="muted">${payload ? escapeHtml(payload) : ""}</td>
        </tr>
      `;
    }).join("");
  return `
    <div class="table-wrap">
      <table class="events-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Occurred At</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function jsonObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const dict = value as Record<string, unknown>;
  for (const key of ["items", "data", "results", "clubs", "teams", "matches"]) {
    const nested = dict[key];
    if (Array.isArray(nested)) {
      return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }
  return [];
}

async function fetchKNHBOptions(url: string, preferredNameKeys: string[]): Promise<KNHBOption[]> {
  const response = await authFetch(url);
  if (!response.ok) {
    throw new Error(`KNHB fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const options: KNHBOption[] = [];
  for (const item of jsonObjects(payload)) {
    const id = firstString(item, ["id", "clubId", "teamId", "code"]);
    const name = firstString(item, preferredNameKeys);
    if (!id || !name) continue;
    const abbreviation = firstString(item, ["abbreviation", "afkorting", "abbr", "kortenaam"]);
    options.push({ id, name, abbreviation });
  }
  return options;
}

async function loadKNHBClubs(): Promise<void> {
  uiState.loading = true;
  render();
  try {
    uiState.clubs = await fetchKNHBOptions(`${KNHB_BASE}/clubs`, ["name", "naam", "clubnaam"]);
    uiState.output = `Loaded ${uiState.clubs.length} clubs`;
  } catch (error) {
    uiState.output = (error as Error).message;
  } finally {
    uiState.loading = false;
    render();
  }
}

async function loadKNHBTeams(clubId: string): Promise<void> {
  uiState.loading = true;
  render();
  try {
    const response = await authFetch(`${KNHB_BASE}/clubs/${encodeURIComponent(clubId)}/teams`);
    if (!response.ok) {
      throw new Error(`KNHB teams fetch failed: ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    const teams: KNHBOption[] = [];
    for (const item of jsonObjects(payload)) {
      const id = firstString(item, ["id", "teamId", "code"]);
      const name = firstString(item, ["name", "naam", "teamnaam"]);
      if (!id || !name) continue;
      const type = firstString(item, ["type", "soort", "discipline", "veldZaal", "veld_zaal", "competitionType"]);
      const subtitle = type;
      teams.push({ id, name, subtitle: subtitle || undefined });
    }
    uiState.teams = teams;
    uiState.selectedTeamId = "";
    uiState.foundMatches = [];
    uiState.activeFavoriteKey = undefined;
    uiState.output = `Loaded ${uiState.teams.length} teams`;
  } catch (error) {
    uiState.output = (error as Error).message;
  } finally {
    uiState.loading = false;
    render();
  }
}

async function fetchKNHBMatchesForTeam(teamId: string, kind: "upcoming" | "official" = "upcoming"): Promise<KNHBMatch[]> {
  const response = await authFetch(`${KNHB_BASE}/teams/${encodeURIComponent(teamId)}/matches/${kind}`);
  if (!response.ok) {
    throw new Error(`KNHB ${kind} matches fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const matches: KNHBMatch[] = [];
  for (const item of jsonObjects(payload)) {
    const parsed = parseKNHBMatchItem(item);
    if (!parsed) continue;
    matches.push({ ...parsed, sourceTeamIds: [teamId] });
  }
  return matches;
}

function dedupeMatches(matches: KNHBMatch[]): KNHBMatch[] {
  const byId = new Map<string, KNHBMatch>();
  for (const match of matches) {
    const existing = byId.get(match.id);
    if (!existing) {
      byId.set(match.id, match);
      continue;
    }
    byId.set(match.id, {
      ...existing,
      ...match,
      sourceTeamIds: Array.from(new Set([...(existing.sourceTeamIds ?? []), ...(match.sourceTeamIds ?? [])])),
    });
  }
  return Array.from(byId.values());
}

async function loadKNHBMatches(teamId: string): Promise<void> {
  uiState.loading = true;
  render();
  try {
    const matches = await fetchKNHBMatchesForTeam(teamId, "upcoming");
    uiState.foundMatches = dedupeMatches(matches);
    uiState.output = `Loaded ${uiState.foundMatches.length} upcoming matches`;
  } catch (error) {
    uiState.output = (error as Error).message;
  } finally {
    uiState.loading = false;
    render();
  }
}

async function loadKNHBMatchesForFavorite(favorite: FavoriteTeam): Promise<void> {
  uiState.loading = true;
  render();
  try {
    let relatedTeamIds = favorite.teamIds;
    if (favorite.clubId) {
      const response = await authFetch(`${KNHB_BASE}/clubs/${encodeURIComponent(favorite.clubId)}/teams`);
      if (response.ok) {
        const payload = (await response.json()) as unknown;
        const resolvedIds = jsonObjects(payload)
          .map((item) => {
            const id = firstString(item, ["id", "teamId", "code"]);
            const name = firstString(item, ["name", "naam", "teamnaam"]);
            if (!id || !name) return undefined;
            return normalizeTeamName(name) === normalizeTeamName(favorite.name) ? id : undefined;
          })
          .filter((value): value is string => !!value);
        if (resolvedIds.length > 0) {
          relatedTeamIds = resolvedIds;
        }
      }
    }
    const all = await Promise.all(relatedTeamIds.map((teamId) => fetchKNHBMatchesForTeam(teamId, "upcoming")));
    uiState.foundMatches = dedupeMatches(all.flat());
    uiState.output = `Loaded ${uiState.foundMatches.length} upcoming matches`;
  } catch (error) {
    uiState.output = (error as Error).message;
  } finally {
    uiState.loading = false;
    render();
  }
}

async function refreshMatchMetadataFromKNHB(match: MatchMetadata): Promise<void> {
  const knhbMatchId = match.knhbMatchId?.trim();
  const teamId = match.knhbSourceTeamId?.trim();
  if (!knhbMatchId || !teamId) {
    uiState.output = "KNHB refresh requires KNHB Match ID and source Team ID.";
    syncLivePanel();
    return;
  }

  uiState.loading = true;
  syncLivePanel();
  try {
    const [upcoming, official] = await Promise.all([
      fetchKNHBMatchesForTeam(teamId, "upcoming"),
      fetchKNHBMatchesForTeam(teamId, "official"),
    ]);
    const merged = dedupeMatches([...upcoming, ...official]);
    const found = merged.find((item) => item.id === knhbMatchId);
    if (!found) {
      throw new Error(`KNHB match ${knhbMatchId} not found for team ${teamId}.`);
    }
    await applyImportedMatch({ ...found, sourceTeamIds: [teamId] }, { forceUpdateMatchId: match.id });
    uiState.output = `Refreshed metadata from KNHB (${knhbMatchId}).`;
  } catch (error) {
    uiState.output = (error as Error).message;
  } finally {
    uiState.loading = false;
    render();
  }
}

type LocalProjection = {
  homeScore: number;
  awayScore: number;
  isRunning: boolean;
  isEnded: boolean;
  currentPeriod: number;
  currentPeriodPlayedSeconds: number;
  totalPlayedSeconds: number;
  format: {
    periodCount: number;
    periodDurationSeconds: number[];
  };
};

function filteredSortedMatches(): MatchMetadata[] {
  const normalized = {
    home: uiState.filterHome.trim().toLowerCase(),
    away: uiState.filterAway.trim().toLowerCase(),
    team: uiState.filterTeam.trim().toLowerCase(),
    club: uiState.filterClub.trim().toLowerCase(),
    field: uiState.filterField.trim().toLowerCase(),
    source: uiState.filterSource,
  };
  const filtered = uiState.matches.filter((match) => {
    if (normalized.home && !match.homeTeam.toLowerCase().includes(normalized.home)) return false;
    if (normalized.away && !match.awayTeam.toLowerCase().includes(normalized.away)) return false;
    if (
      normalized.team &&
      !match.homeTeam.toLowerCase().includes(normalized.team) &&
      !match.awayTeam.toLowerCase().includes(normalized.team)
    ) return false;
    if (normalized.club && !(match.locationClubName ?? "").toLowerCase().includes(normalized.club)) return false;
    if (normalized.field && !(match.fieldName ?? "").toLowerCase().includes(normalized.field)) return false;
    if (normalized.source !== "all" && match.source !== normalized.source) return false;
    return true;
  });
  const direction = uiState.sortDirection === "asc" ? 1 : -1;
  return filtered.sort((left, right) => {
    const field = uiState.sortField;
    const leftValue = field === "matchDateTime"
      ? Date.parse(left.matchDateTime ?? left.createdAt)
      : field === "createdAt"
        ? Date.parse(left.createdAt)
        : (left[field] ?? "").toString().toLowerCase();
    const rightValue = field === "matchDateTime"
      ? Date.parse(right.matchDateTime ?? right.createdAt)
      : field === "createdAt"
        ? Date.parse(right.createdAt)
        : (right[field] ?? "").toString().toLowerCase();
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}

function replayKnownEvents(events: MatchEvent[], nowMs: number): LocalProjection {
  const ordered = [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt.localeCompare(b.occurredAt);
    const seqA = a.sequence ?? 0;
    const seqB = b.sequence ?? 0;
    if ((a.originDeviceId ?? "") !== (b.originDeviceId ?? "")) {
      return (a.originDeviceId ?? "").localeCompare(b.originDeviceId ?? "");
    }
    return seqA - seqB;
  });

  let homeScore = 0;
  let awayScore = 0;
  let isRunning = false;
  let isEnded = false;
  let currentPeriod = 1;
  let totalPlayedSeconds = 0;
  let currentPeriodPlayedSeconds = 0;
  let runningFromMs: number | null = null;
  let format = { periodCount: 4, periodDurationSeconds: [1050, 1050, 1050, 1050] };

  for (const event of ordered) {
    const occurredAtMs = Date.parse(event.occurredAt);
    if (Number.isNaN(occurredAtMs)) continue;
    const payload = event.payload ?? {};

    if (event.eventType === "score.changed") {
      const team = payload.team;
      const delta = Number(payload.delta ?? 0);
      if (team === "home") homeScore += delta;
      if (team === "away") awayScore += delta;
    }

    if (event.eventType === "match.format.updated") {
      const payloadCount = Number(payload.periodCount ?? format.periodCount);
      const payloadDurations = Array.isArray(payload.periodDurationSeconds) ? payload.periodDurationSeconds : format.periodDurationSeconds;
      format = {
        periodCount: Number.isFinite(payloadCount) ? payloadCount : format.periodCount,
        periodDurationSeconds: payloadDurations.map((value) => Number(value)),
      };
    }

    if (event.eventType === "match.started" || event.eventType === "match.resumed") {
      if (isEnded) continue;
      isRunning = true;
      runningFromMs = occurredAtMs;
    }

    if (event.eventType === "match.paused" || event.eventType === "match.ended" || event.eventType === "period.ended") {
      if (runningFromMs !== null) {
        const delta = Math.max(0, Math.floor((occurredAtMs - runningFromMs) / 1000));
        totalPlayedSeconds += delta;
        currentPeriodPlayedSeconds += delta;
      }
      isRunning = false;
      runningFromMs = null;
    }

    if (event.eventType === "period.started") {
      currentPeriod = Number(payload.period ?? currentPeriod);
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "period.set") {
      const requested = Number(payload.period ?? currentPeriod);
      const bounded = Math.max(1, Math.min(format.periodCount, Number.isFinite(requested) ? requested : currentPeriod));
      currentPeriod = bounded;
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "period.ended") {
      currentPeriod = Math.min(format.periodCount, currentPeriod + 1);
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "clock.reset") {
      currentPeriodPlayedSeconds = 0;
    }

    if (event.eventType === "clock.adjusted") {
      const deltaSeconds = Number(payload.deltaSeconds ?? 0);
      if (Number.isFinite(deltaSeconds)) {
        currentPeriodPlayedSeconds = Math.max(0, currentPeriodPlayedSeconds + deltaSeconds);
      }
    }

    if (event.eventType === "match.ended") {
      isEnded = true;
    }
  }

  if (isRunning && runningFromMs !== null) {
    const liveDelta = Math.max(0, Math.floor((nowMs - runningFromMs) / 1000));
    totalPlayedSeconds += liveDelta;
    currentPeriodPlayedSeconds += liveDelta;
  }

  return {
    homeScore,
    awayScore,
    isRunning,
    isEnded,
    currentPeriod,
    currentPeriodPlayedSeconds,
    totalPlayedSeconds,
    format,
  };
}

function timerFromLocalProjection(local: LocalProjection): { label: string; isOverrun: boolean } {
  const periodIndex = Math.max(0, local.currentPeriod - 1);
  const configured = local.format.periodDurationSeconds[periodIndex] ?? local.format.periodDurationSeconds.at(-1) ?? 0;
  const remaining = configured - local.currentPeriodPlayedSeconds;
  if (remaining >= 0) {
    return { label: `${formatClock(remaining)}`, isOverrun: false };
  }
  return { label: `+${formatClock(Math.abs(remaining))}`, isOverrun: true };
}

function renderKNHBImportSection(title = "Import KNHB", importButton = "Import"): string {
  const filteredClubs =
    uiState.clubQuery.trim().length > 0
      ? uiState.clubs.filter((club) => club.name.toLowerCase().includes(uiState.clubQuery.trim().toLowerCase()))
      : [];
  const selectedTeam = uiState.teams.find((team) => team.id === uiState.selectedTeamId);
  const selectedTeamFavoriteKey =
    selectedTeam && uiState.selectedClubId
      ? favoriteTeamKey(uiState.selectedClubId, selectedTeam.name)
      : undefined;
  const selectedTeamIsFavorite = selectedTeamFavoriteKey ? isFavoriteTeamKey(selectedTeamFavoriteKey) : false;

  return `
    <section class="card">
      <h3>${escapeHtml(title)}</h3>
      <div class="stack">
        <h4>Favorite Teams</h4>
        <div class="club-results">
          ${
            uiState.favoriteTeams.length === 0
              ? `<div class="muted">No favorite teams yet</div>`
              : uiState.favoriteTeams.map((team) => `
                <div class="found-match">
                  <div><strong>${escapeHtml(team.name)}</strong>${team.clubName ? ` <span class="muted">(${escapeHtml(team.clubName)})</span>` : ""}</div>
                  <div class="row">
                    <button class="js-load-favorite-team" data-favorite-key="${escapeHtml(team.key)}">Load Matches</button>
                    <button class="js-remove-favorite-team" data-favorite-key="${escapeHtml(team.key)}">Unfavorite</button>
                  </div>
                </div>
              `).join("")
          }
        </div>
        <button id="loadClubs">Load Clubs</button>
        <input id="clubQuery" type="text" placeholder="Search club" value="${escapeHtml(uiState.clubQuery)}" />
        <div class="club-results">
          ${filteredClubs.slice(0, 25).map((club) => {
            const selected = club.id === uiState.selectedClubId ? "selected" : "";
            const subtitle = club.subtitle ? ` (${escapeHtml(club.subtitle)})` : "";
            const clubLabel = club.abbreviation ?? club.name;
            return `<button class="js-select-club ${selected}" data-club-id="${escapeHtml(club.id)}">${escapeHtml(clubLabel)}${subtitle}</button>`;
          }).join("")}
        </div>
        <button id="loadTeams" ${uiState.selectedClubId ? "" : "disabled"}>Load Teams</button>
        <select id="teamSelect" ${uiState.teams.length > 0 ? "" : "disabled"}>
          <option value="">Choose team</option>
          ${uiState.teams.map((team) => {
            const selected = team.id === uiState.selectedTeamId ? "selected" : "";
            const subtitle = team.subtitle ? ` (${team.subtitle})` : "";
            return `<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.name + subtitle)}</option>`;
          }).join("")}
        </select>
        ${selectedTeam ? `<button id="toggleFavoriteTeam">${selectedTeamIsFavorite ? "Unfavorite Team" : "Favorite Team"}</button>` : ""}
        <button id="loadMatches" ${uiState.selectedTeamId ? "" : "disabled"}>Load Upcoming Matches</button>
        <div class="found-matches">
          ${uiState.foundMatches.map((match) => {
            const parsed = parsePossibleDate(match.dateRaw);
            const label = parsed ? (formatAmsterdamDate(parsed) ?? "Date unknown") : "Date unknown";
            return `
              <div class="found-match">
                <div><strong>${escapeHtml(match.homeTeam)} – ${escapeHtml(match.awayTeam)}</strong></div>
                <div class="muted">${escapeHtml(label)}</div>
                <button class="js-import-match" data-knhb-match-id="${escapeHtml(match.id)}">${escapeHtml(importButton)}</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderListView(): string {
  const rows = filteredSortedMatches();
  return `
    <section class="card">
      <div class="title-row">
        <h2>Matches</h2>
        <div class="row">
          <span class="muted">${rows.length} shown</span>
          <button id="clearFilters" class="ghost">Clear Filters</button>
          <button id="newMatch">New Match</button>
          <button id="quickMatchList" class="ghost">Quick Match</button>
        </div>
      </div>
      <div class="filters-grid">
        <input id="filterTeam" placeholder="Filter team (home/away)" value="${escapeHtml(uiState.filterTeam)}" />
        <input id="filterHome" placeholder="Filter home" value="${escapeHtml(uiState.filterHome)}" />
        <input id="filterAway" placeholder="Filter away" value="${escapeHtml(uiState.filterAway)}" />
        <input id="filterClub" placeholder="Filter location" value="${escapeHtml(uiState.filterClub)}" />
        <input id="filterField" placeholder="Filter field" value="${escapeHtml(uiState.filterField)}" />
        <select id="filterSource">
          <option value="all" ${uiState.filterSource === "all" ? "selected" : ""}>All sources</option>
          <option value="knhb" ${uiState.filterSource === "knhb" ? "selected" : ""}>KNHB</option>
          <option value="web-custom" ${uiState.filterSource === "web-custom" ? "selected" : ""}>Web custom</option>
          <option value="local" ${uiState.filterSource === "local" ? "selected" : ""}>Local</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="matches-table">
          <thead>
            <tr>
              <th><button class="table-sort js-sort" data-field="homeTeam">Home</button></th>
              <th><button class="table-sort js-sort" data-field="awayTeam">Away</button></th>
              <th>Score</th>
              <th><button class="table-sort js-sort" data-field="matchDateTime">Date</button></th>
              <th><button class="table-sort js-sort" data-field="locationClubName">Location</button></th>
              <th><button class="table-sort js-sort" data-field="fieldName">Field</button></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((match) => `
              <tr class="js-open-match" data-match-id="${escapeHtml(match.id)}">
                <td>${escapeHtml(match.homeTeam)}</td>
                <td>${escapeHtml(match.awayTeam)}</td>
                <td class="score-cell">${
                  uiState.listScores[match.id]
                    ? `<span class="score-pill">${uiState.listScores[match.id].homeScore} - ${uiState.listScores[match.id].awayScore}</span>`
                    : "-"
                }</td>
                <td>${escapeHtml(formatAmsterdamDate(match.matchDateTime ?? match.createdAt) ?? "Unknown")}</td>
                <td>${escapeHtml(match.locationClubName ?? "")}</td>
                <td>${escapeHtml(match.fieldName ?? "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAuthPanel(): string {
  const configured = authConfigured();
  const signedIn = !!loadAuthState();
  const providerLabel = AUTH_ISSUER ? ` via ${escapeHtml(AUTH_ISSUER)}` : "";
  const status = !configured
    ? "Auth not configured. Web API sync disabled."
    : signedIn
      ? `Signed in${providerLabel}`
      : "Sign in required for web/API sync.";

  return `
    <section class="auth-panel">
      <span>${status}</span>
      ${
        signedIn
          ? `<button id="signOut" class="ghost">Sign Out</button>`
          : `<button id="signIn" ${configured ? "" : "disabled"}>Sign In</button>`
      }
    </section>
  `;
}

function renderCreateView(): string {
  const targetLabel = uiState.importTarget === "update" ? "Assign KNHB To Current Match" : "Import KNHB Match";
  const importAction = uiState.importTarget === "update" ? "Assign To Match" : "Create Match";
  return `
    <section class="card">
      <div class="title-row">
        <h2>Create Match</h2>
        <button id="backFromCreate" class="ghost">Back</button>
      </div>
      <p class="muted">Default flow: import from KNHB. Use custom only if needed.</p>
      <div class="row">
        <button id="modeKNHB" ${uiState.createMode === "knhb" ? "disabled" : ""}>KNHB Import</button>
        <button id="modeCustom" class="ghost" ${uiState.createMode === "custom" ? "disabled" : ""}>Custom Match</button>
        <button id="quickMatchCreate">Quick Match (Now)</button>
      </div>
    </section>
    ${
      uiState.createMode === "custom"
        ? `
          <section class="card">
            <h3>Custom Match</h3>
            <div class="stack">
              <input id="createHome" type="text" placeholder="Home team" />
              <input id="createAway" type="text" placeholder="Away team" />
              <input id="createLocationClub" type="text" placeholder="Location (optional)" />
              <input id="createFieldName" type="text" placeholder="Field name (optional)" />
              <input id="createPeriodCount" type="number" min="1" max="12" step="1" value="4" placeholder="Periods" />
              <input id="createPeriodMinutes" type="number" min="1" max="60" step="0.5" value="17.5" placeholder="Minutes per period" />
              <label for="createDateTime">Match date/time</label>
              <input id="createDateTime" type="datetime-local" />
              <button id="createMatch">Create Custom Match</button>
            </div>
          </section>
        `
        : renderKNHBImportSection(targetLabel, importAction)
    }
  `;
}

function renderMatchView(match: MatchMetadata): string {
  const local = replayKnownEvents(uiState.events, uiState.liveNowMs);
  const control = primaryClockControlState(local, uiState.events);
  const timer = timerFromLocalProjection(local);
  const stateLabel = local.isEnded ? "ENDED" : local.isRunning ? "RUNNING" : "PAUSED";
  const shortcutsModal = uiState.showShortcutsModal
    ? `
      <div class="modal-backdrop"></div>
      <section class="card modal-card shortcuts-modal">
        <div class="title-row">
          <h3>Keyboard Shortcuts</h3>
          <button id="closeShortcutsModal" class="ghost">Close</button>
        </div>
        <div class="shortcuts-grid">
          <div><kbd>Space</kbd> Start/Pause/Resume</div>
          <div><kbd>H</kbd> Home +1</div>
          <div><kbd>Shift+H</kbd> Home -1</div>
          <div><kbd>A</kbd> Away +1</div>
          <div><kbd>Shift+A</kbd> Away -1</div>
          <div><kbd>E</kbd> End Period</div>
          <div><kbd>P</kbd> Previous Period</div>
          <div><kbd>M</kbd> End Match (paused)</div>
          <div><kbd>0</kbd> Reset Clock</div>
          <div><kbd>,</kbd> -60s</div>
          <div><kbd>.</kbd> +60s</div>
          <div><kbd>&lt;</kbd> -10s</div>
          <div><kbd>&gt;</kbd> +10s</div>
          <div><kbd>R</kbd> Refresh</div>
          <div><kbd>Esc</kbd> Exit scoreboard mode / back to list</div>
          <div><kbd>?</kbd> Toggle this help</div>
        </div>
      </section>
    `
    : "";
  if (uiState.scoreboardMode) {
    return `
      <section class="scoreboard-screen">
        <div class="scoreboard-topline">
          <span>${escapeHtml(match.homeTeam)}</span>
          <span id="livePeriodSummary">${escapeHtml(periodLabel(local.currentPeriod, local.format.periodCount))} • ${stateLabel}</span>
          <span>${escapeHtml(match.awayTeam)}</span>
        </div>
        <div class="scoreboard-main">
          <div id="scoreHome" class="scoreboard-team-value">${local.homeScore}</div>
          <div class="scoreboard-clock-wrap">
            <div id="liveClock" class="scoreboard-clock ${timer.isOverrun ? "overrun" : ""}">${escapeHtml(timer.label)}</div>
          </div>
          <div id="scoreAway" class="scoreboard-team-value">${local.awayScore}</div>
        </div>
      </section>
      ${shortcutsModal}
    `;
  }
  const fullscreenLabel = document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen";
  const menu = uiState.matchMenuOpen
    ? `
      <div class="match-menu" role="menu">
        <button id="refreshMenu" class="ghost menu-item" role="menuitem">Refresh <kbd>R</kbd></button>
        <button id="openMetadataModal" class="ghost menu-item" role="menuitem">Edit Metadata</button>
        <button id="assignFromKNHB" class="ghost menu-item" role="menuitem">Import/Assign KNHB</button>
        <button id="toggleFullscreen" class="ghost menu-item" role="menuitem">${fullscreenLabel}</button>
        <label class="menu-check">
          <input id="toggleScoreboardMode" type="checkbox" ${uiState.scoreboardMode ? "checked" : ""} />
          <span>Scoreboard Mode</span>
        </label>
        <label class="menu-check">
          <input id="toggleEventStream" type="checkbox" ${uiState.showEventStream ? "checked" : ""} />
          <span>Show Event Stream</span>
        </label>
      </div>
    `
    : "";
  return `
    <section class="card">
      <div class="title-row">
        <button id="backToList" class="ghost">Back To Matches (Esc)</button>
        <div class="row">
          <span class="muted">${escapeHtml(match.id)}</span>
          <div class="match-menu-anchor">
            <button id="matchMenuButton" class="ghost kebab-button" aria-label="Match menu">⋮</button>
            ${menu}
          </div>
        </div>
      </div>
      <h2>${escapeHtml(matchTitle(match))}</h2>
      <p class="muted">${escapeHtml(matchSubtitle(match) || "No metadata")}</p>
      <div class="score-layout ${uiState.scoreboardMode ? "scoreboard-mode" : ""}">
        ${
          uiState.scoreboardMode
            ? ""
            : `
              <div class="grid-cell score-control-top">
                <button class="js-action home-action score-action score-action-plus" data-action="homePlus">+1 <kbd>H</kbd></button>
              </div>
              <div class="grid-cell center-top-controls">
                <div class="time-controls-row">
                  <button id="primaryClockAction" class="js-action ${control.cssClass}" data-action="${control.action ?? ""}" ${control.action ? "" : "disabled"}>${control.label} <kbd>${control.hotkey}</kbd></button>
                </div>
                <div class="time-controls-row">
                  <button id="endMatchAction" class="js-action danger" data-action="endMatch" ${control.canEndMatch ? "" : "hidden"}>End Match <kbd>M</kbd></button>
                  <button id="resetClockAction" class="js-action clock-action" data-action="clockReset" ${control.canResetClock ? "" : "hidden"}>Reset Clock <kbd>0</kbd></button>
                </div>
              </div>
              <div class="grid-cell score-control-top">
                <button class="js-action away-action score-action score-action-plus" data-action="awayPlus">+1 <kbd>A</kbd></button>
              </div>
            `
        }

        <div class="grid-cell team-score">
          <div class="team-label">Home</div>
          <div id="scoreHome" class="score-number">${local.homeScore}</div>
          ${match.homeTeam.trim() && match.homeTeam.trim().toLowerCase() !== "home" ? `<div class="team-name">${escapeHtml(match.homeTeam)}</div>` : ""}
        </div>
        <div class="grid-cell clock-panel">
          <div id="liveClock" class="clock ${timer.isOverrun ? "overrun" : ""}">${escapeHtml(timer.label)}</div>
          <div id="liveState" class="state-pill">${stateLabel}</div>
          <div id="livePeriod" class="muted">${escapeHtml(periodLabel(local.currentPeriod, local.format.periodCount))}</div>
        </div>
        <div class="grid-cell team-score">
          <div class="team-label">Away</div>
          <div id="scoreAway" class="score-number">${local.awayScore}</div>
          ${match.awayTeam.trim() && match.awayTeam.trim().toLowerCase() !== "away" ? `<div class="team-name">${escapeHtml(match.awayTeam)}</div>` : ""}
        </div>
        ${
          uiState.scoreboardMode
            ? ""
            : `
              <div class="grid-cell score-control-bottom">
                <button class="js-action home-action score-action score-action-minus" data-action="homeMinus">-1 <kbd>Shift+H</kbd></button>
              </div>
              <div class="grid-cell center-bottom-controls">
                <div class="time-controls-row three-cols">
                  <button id="advancePeriodAction" class="js-action clock-action ${timer.isOverrun ? "period-advance-highlight" : ""}" data-action="endPeriod">+ ${periodUnit(local.format.periodCount)} <kbd>E</kbd></button>
                  <button class="js-action clock-action" data-action="clockPlus60">+ 1:00 <kbd>.</kbd></button>
                  <button class="js-action clock-action" data-action="clockPlus10">+ 0:10 <kbd>&gt;</kbd></button>
                </div>
                <div class="time-controls-row three-cols">
                  <button id="previousPeriodAction" class="js-action clock-action" data-action="previousPeriod">- ${periodUnit(local.format.periodCount)} <kbd>P</kbd></button>
                  <button class="js-action clock-action" data-action="clockMinus60">- 1:00 <kbd>,</kbd></button>
                  <button class="js-action clock-action" data-action="clockMinus10">- 0:10 <kbd>&lt;</kbd></button>
                </div>
              </div>
              <div class="grid-cell score-control-bottom">
                <button class="js-action away-action score-action score-action-minus" data-action="awayMinus">-1 <kbd>Shift+A</kbd></button>
              </div>
            `
        }
      </div>
      ${uiState.showEventStream ? `
      <h3>Events</h3>
      <div id="liveEvents" class="events-list">${renderEventsList()}</div>
      ` : ""}
      <div id="liveOutput" class="status-line muted">${escapeHtml(uiState.loading ? "Loading..." : uiState.output)}</div>
    </section>
    ${
      uiState.metadataModalOpen
        ? `
          <div class="modal-backdrop"></div>
          <section class="card modal-card">
            <div class="title-row">
              <h3>Edit Match Metadata</h3>
              <button id="closeMetadataModal" class="ghost">Close</button>
            </div>
            <div class="filters-grid">
              <input id="editHome" value="${escapeHtml(match.homeTeam)}" placeholder="Home team" />
              <input id="editAway" value="${escapeHtml(match.awayTeam)}" placeholder="Away team" />
              <input id="editLocationClub" value="${escapeHtml(match.locationClubName ?? "")}" placeholder="Location" />
              <input id="editFieldName" value="${escapeHtml(match.fieldName ?? "")}" placeholder="Field name" />
              <input id="editKNHBMatchId" value="${escapeHtml(match.knhbMatchId ?? "")}" placeholder="KNHB Match ID" />
              <input id="editPeriodCount" type="number" min="1" max="12" step="1" value="${String(local.format.periodCount)}" placeholder="Periods" />
              <input id="editPeriodMinutes" type="number" min="1" max="60" step="0.5" value="${String((local.format.periodDurationSeconds[0] ?? 1050) / 60)}" placeholder="Minutes per period" />
            </div>
            <div class="row">
              <label for="editDateTime" class="muted">Match date/time (Europe/Amsterdam)</label>
              <input id="editDateTime" type="datetime-local" value="${escapeHtml(formatForDateTimeLocal(match.matchDateTime))}" />
              <button id="saveMetadata">Save Metadata</button>
              <button id="refreshKNHBMetadata" class="ghost" ${match.knhbMatchId && match.knhbSourceTeamId ? "" : "disabled"}>Refresh KNHB Data</button>
            </div>
          </section>
        `
        : ""
    }
    ${shortcutsModal}
  `;
}

function render(): void {
  const selectedMatch = getSelectedMatch();
  const body = uiState.view === "match" && selectedMatch
    ? renderMatchView(selectedMatch)
    : uiState.view === "create"
      ? renderCreateView()
      : renderListView();

  if (uiState.view === "match" && selectedMatch && uiState.scoreboardMode) {
    appRoot.innerHTML = body;
    wireHandlers();
    return;
  }

  appRoot.innerHTML = `
    <div class="app-shell">
      <h1>Hockey Timer</h1>
      ${renderAuthPanel()}
      ${body}
    </div>
  `;
  wireHandlers();
}

function syncLivePanel(): void {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch || uiState.view !== "match") return;
  const local = replayKnownEvents(uiState.events, uiState.liveNowMs);
  const timer = timerFromLocalProjection(local);
  const control = primaryClockControlState(local, uiState.events);
  const scoreHome = appRoot.querySelector<HTMLElement>("#scoreHome");
  const scoreAway = appRoot.querySelector<HTMLElement>("#scoreAway");
  const state = appRoot.querySelector<HTMLElement>("#liveState");
  const period = appRoot.querySelector<HTMLElement>("#livePeriod");
  const periodSummary = appRoot.querySelector<HTMLElement>("#livePeriodSummary");
  const clock = appRoot.querySelector<HTMLElement>("#liveClock");
  const output = appRoot.querySelector<HTMLElement>("#liveOutput");
  const events = appRoot.querySelector<HTMLElement>("#liveEvents");
  const primaryClockAction = appRoot.querySelector<HTMLButtonElement>("#primaryClockAction");
  const endMatchAction = appRoot.querySelector<HTMLButtonElement>("#endMatchAction");
  const resetClockAction = appRoot.querySelector<HTMLButtonElement>("#resetClockAction");
  const advancePeriodAction = appRoot.querySelector<HTMLButtonElement>("#advancePeriodAction");
  const previousPeriodAction = appRoot.querySelector<HTMLButtonElement>("#previousPeriodAction");

  if (scoreHome) scoreHome.textContent = String(local.homeScore);
  if (scoreAway) scoreAway.textContent = String(local.awayScore);
  if (state) state.textContent = local.isEnded ? "ENDED" : local.isRunning ? "RUNNING" : "PAUSED";
  if (period) period.textContent = periodLabel(local.currentPeriod, local.format.periodCount);
  if (periodSummary) periodSummary.textContent = `${periodLabel(local.currentPeriod, local.format.periodCount)} • ${local.isEnded ? "ENDED" : local.isRunning ? "RUNNING" : "PAUSED"}`;
  if (clock) {
    clock.textContent = timer.label;
    clock.classList.toggle("overrun", timer.isOverrun);
  }
  if (advancePeriodAction) {
    advancePeriodAction.classList.toggle("period-advance-highlight", timer.isOverrun);
    advancePeriodAction.innerHTML = `+ ${periodUnit(local.format.periodCount)} <kbd>E</kbd>`;
  }
  if (previousPeriodAction) {
    previousPeriodAction.innerHTML = `- ${periodUnit(local.format.periodCount)} <kbd>P</kbd>`;
  }
  if (primaryClockAction) {
    primaryClockAction.classList.toggle("danger", control.cssClass === "danger");
    primaryClockAction.classList.toggle("neutral-action", control.cssClass === "neutral-action");
    primaryClockAction.disabled = !control.action;
    primaryClockAction.dataset.action = control.action ?? "";
    primaryClockAction.innerHTML = `${control.label} <kbd>${control.hotkey}</kbd>`;
  }
  if (endMatchAction) {
    endMatchAction.hidden = !control.canEndMatch;
  }
  if (resetClockAction) {
    resetClockAction.hidden = !control.canResetClock;
  }
  if (output) output.textContent = uiState.loading ? "Loading..." : uiState.output;
  if (events) events.innerHTML = renderEventsList();
}

async function triggerAction(action: string): Promise<void> {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch) return;

  const local = replayKnownEvents(uiState.events, Date.now());
  const matchStarted = hasMatchStarted(uiState.events);
  if (action === "previousPeriod") {
    if (local.currentPeriod <= 1) {
      uiState.output = "Already at first period.";
      syncLivePanel();
      return;
    }
    try {
      await pushEvent(selectedMatch.id, "period.set", { period: local.currentPeriod - 1 });
      await refreshProjection();
    } catch (error) {
      uiState.output = (error as Error).message;
      syncLivePanel();
    }
    return;
  }

  if (action === "endMatch" && (local.isRunning || local.isEnded || !matchStarted)) {
    return;
  }
  if (action === "clockReset" && (local.isRunning || local.isEnded || local.currentPeriodPlayedSeconds <= 0)) {
    return;
  }

  const actionToEvent: Record<string, { eventType: string; payload: Record<string, string | number> | object }> = {
    start: { eventType: "match.started", payload: {} },
    pause: { eventType: "match.paused", payload: {} },
    resume: { eventType: "match.resumed", payload: {} },
    endPeriod: { eventType: "period.ended", payload: {} },
    clockReset: { eventType: "clock.reset", payload: {} },
    clockMinus60: { eventType: "clock.adjusted", payload: { deltaSeconds: -60 } },
    clockMinus10: { eventType: "clock.adjusted", payload: { deltaSeconds: -10 } },
    clockPlus10: { eventType: "clock.adjusted", payload: { deltaSeconds: 10 } },
    clockPlus60: { eventType: "clock.adjusted", payload: { deltaSeconds: 60 } },
    endMatch: { eventType: "match.ended", payload: {} },
    homePlus: { eventType: "score.changed", payload: { team: "home", delta: 1, reason: "goal" } },
    awayPlus: { eventType: "score.changed", payload: { team: "away", delta: 1, reason: "goal" } },
    homeMinus: { eventType: "score.changed", payload: { team: "home", delta: -1, reason: "correction" } },
    awayMinus: { eventType: "score.changed", payload: { team: "away", delta: -1, reason: "correction" } },
  };
  const mapped = actionToEvent[action];
  if (!mapped) return;
  try {
    await pushEvent(selectedMatch.id, mapped.eventType, mapped.payload);
    await refreshProjection();
  } catch (error) {
    uiState.output = (error as Error).message;
    syncLivePanel();
  }
}

function applySort(field: UIState["sortField"]): void {
  if (uiState.sortField === field) {
    uiState.sortDirection = uiState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    uiState.sortField = field;
    uiState.sortDirection = field === "matchDateTime" || field === "createdAt" ? "desc" : "asc";
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    uiState.output = `Fullscreen toggle failed: ${(error as Error).message}`;
    syncLivePanel();
  }
}

function renderWithInputFocus(inputId: string, selectionStart: number | null, selectionEnd: number | null): void {
  render();
  const replacement = appRoot.querySelector<HTMLInputElement>(`#${inputId}`);
  if (!replacement) return;
  replacement.focus();
  if (selectionStart !== null && selectionEnd !== null) {
    replacement.setSelectionRange(selectionStart, selectionEnd);
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function initKeyboardShortcuts(): void {
  if ((window as { __hockeyShortcutsBound?: boolean }).__hockeyShortcutsBound) return;
  (window as { __hockeyShortcutsBound?: boolean }).__hockeyShortcutsBound = true;
  document.addEventListener("keydown", (event) => {
    if (uiState.view !== "match") return;
    if (isEditable(event.target)) return;
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      uiState.showShortcutsModal = !uiState.showShortcutsModal;
      render();
      return;
    }
    if (uiState.showShortcutsModal) {
      if (event.key === "Escape") {
        event.preventDefault();
        uiState.showShortcutsModal = false;
        render();
      }
      return;
    }
    if (event.key === "Escape") {
      if (uiState.scoreboardMode) {
        uiState.scoreboardMode = false;
        uiState.matchMenuOpen = false;
        uiState.showShortcutsModal = false;
        render();
        return;
      }
      uiState.view = "list";
      render();
      return;
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      void refreshProjection();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      const local = replayKnownEvents(uiState.events, Date.now());
      const hasStarted = hasMatchStarted(uiState.events);
      if (local.isRunning) {
        void triggerAction("pause");
      } else if (hasStarted) {
        void triggerAction("resume");
      } else {
        void triggerAction("start");
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "e") void triggerAction("endPeriod");
    if (key === "p") void triggerAction("previousPeriod");
    if (key === "m") void triggerAction("endMatch");
    if (event.key === "0") void triggerAction("clockReset");
    if ((event.key === "," && !event.shiftKey)) void triggerAction("clockMinus60");
    if ((event.key === "." && !event.shiftKey)) void triggerAction("clockPlus60");
    if (event.key === "<" || (event.key === "," && event.shiftKey)) void triggerAction("clockMinus10");
    if (event.key === ">" || (event.key === "." && event.shiftKey)) void triggerAction("clockPlus10");
    if (key === "h") void triggerAction(event.shiftKey ? "homeMinus" : "homePlus");
    if (key === "a") void triggerAction(event.shiftKey ? "awayMinus" : "awayPlus");
  });
}

function wireHandlers(): void {
  appRoot.querySelector<HTMLButtonElement>("#signIn")?.addEventListener("click", () => {
    void beginSignIn();
  });

  appRoot.querySelector<HTMLButtonElement>("#signOut")?.addEventListener("click", () => {
    clearAuthState();
    uiState.output = "Signed out.";
    render();
  });

  appRoot.querySelectorAll<HTMLElement>(".js-open-match").forEach((element) => {
    element.addEventListener("click", () => {
      const id = element.dataset.matchId;
      if (!id) return;
      uiState.selectedMatchId = id;
      localStorage.setItem(selectedMatchIdKey, id);
      uiState.events = [];
      uiState.matchMenuOpen = false;
      uiState.metadataModalOpen = false;
      uiState.view = "match";
      render();
      void refreshProjection();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#backToList")?.addEventListener("click", () => {
    uiState.view = "list";
    uiState.importTarget = "new";
    uiState.importTargetMatchId = undefined;
    uiState.matchMenuOpen = false;
    uiState.metadataModalOpen = false;
    uiState.showShortcutsModal = false;
    render();
    void refreshListScores();
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-sort").forEach((element) => {
    element.addEventListener("click", () => {
      const field = element.dataset.field as UIState["sortField"] | undefined;
      if (!field) return;
      applySort(field);
      render();
    });
  });

  for (const [id, key] of [
    ["filterTeam", "filterTeam"],
    ["filterHome", "filterHome"],
    ["filterAway", "filterAway"],
    ["filterClub", "filterClub"],
    ["filterField", "filterField"],
  ] as const) {
    const input = appRoot.querySelector<HTMLInputElement>(`#${id}`);
    input?.addEventListener("input", () => {
      uiState[key] = input.value;
      renderWithInputFocus(id, input.selectionStart, input.selectionEnd);
    });
  }

  const sourceSelect = appRoot.querySelector<HTMLSelectElement>("#filterSource");
  sourceSelect?.addEventListener("change", () => {
    uiState.filterSource = (sourceSelect.value as UIState["filterSource"]) ?? "all";
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#newMatch")?.addEventListener("click", () => {
    uiState.view = "create";
    uiState.createMode = "knhb";
    uiState.importTarget = "new";
    uiState.importTargetMatchId = undefined;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#clearFilters")?.addEventListener("click", () => {
    uiState.filterTeam = "";
    uiState.filterHome = "";
    uiState.filterAway = "";
    uiState.filterClub = "";
    uiState.filterField = "";
    uiState.filterSource = "all";
    render();
    void refreshListScores();
  });

  appRoot.querySelector<HTMLButtonElement>("#quickMatchList")?.addEventListener("click", () => {
    const metadata = createQuickMatch();
    upsertMatch(metadata);
    void emitMatchMetadataEvent(metadata.id, "match.created", metadataPayload(metadata));
    uiState.selectedMatchId = metadata.id;
    localStorage.setItem(selectedMatchIdKey, metadata.id);
    uiState.events = [];
    uiState.view = "match";
    render();
    void refreshProjection();
  });

  appRoot.querySelector<HTMLButtonElement>("#backFromCreate")?.addEventListener("click", () => {
    uiState.view = uiState.importTarget === "update" ? "match" : "list";
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#matchMenuButton")?.addEventListener("click", () => {
    uiState.matchMenuOpen = !uiState.matchMenuOpen;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#openMetadataModal")?.addEventListener("click", () => {
    uiState.metadataModalOpen = true;
    uiState.matchMenuOpen = false;
    render();
  });

  appRoot.querySelector<HTMLInputElement>("#toggleEventStream")?.addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLInputElement;
    uiState.showEventStream = target.checked;
    uiState.matchMenuOpen = false;
    render();
  });

  appRoot.querySelector<HTMLInputElement>("#toggleScoreboardMode")?.addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLInputElement;
    uiState.scoreboardMode = target.checked;
    uiState.matchMenuOpen = false;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#toggleFullscreen")?.addEventListener("click", () => {
    uiState.matchMenuOpen = false;
    render();
    void toggleFullscreen();
  });

  appRoot.querySelector<HTMLButtonElement>("#closeMetadataModal")?.addEventListener("click", () => {
    uiState.metadataModalOpen = false;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#closeShortcutsModal")?.addEventListener("click", () => {
    uiState.showShortcutsModal = false;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#modeKNHB")?.addEventListener("click", () => {
    uiState.createMode = "knhb";
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#modeCustom")?.addEventListener("click", () => {
    uiState.createMode = "custom";
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#quickMatchCreate")?.addEventListener("click", () => {
    const metadata = createQuickMatch();
    upsertMatch(metadata);
    void emitMatchMetadataEvent(metadata.id, "match.created", metadataPayload(metadata));
    uiState.selectedMatchId = metadata.id;
    localStorage.setItem(selectedMatchIdKey, metadata.id);
    uiState.events = [];
    uiState.view = "match";
    render();
    void refreshProjection();
  });

  appRoot.querySelector<HTMLButtonElement>("#createMatch")?.addEventListener("click", () => {
    const homeTeam = (appRoot.querySelector<HTMLInputElement>("#createHome")?.value ?? "").trim() || "Home";
    const awayTeam = (appRoot.querySelector<HTMLInputElement>("#createAway")?.value ?? "").trim() || "Away";
    const locationClubName = (appRoot.querySelector<HTMLInputElement>("#createLocationClub")?.value ?? "").trim();
    const fieldName = (appRoot.querySelector<HTMLInputElement>("#createFieldName")?.value ?? "").trim();
    const dateTimeRaw = appRoot.querySelector<HTMLInputElement>("#createDateTime")?.value ?? "";
    const periodCountRaw = appRoot.querySelector<HTMLInputElement>("#createPeriodCount")?.value ?? "";
    const periodMinutesRaw = appRoot.querySelector<HTMLInputElement>("#createPeriodMinutes")?.value ?? "";
    const periodConfig = parsePeriodConfig(periodCountRaw, periodMinutesRaw);
    const metadata: MatchMetadata = {
      id: `web-${crypto.randomUUID().toLowerCase()}`,
      source: "web-custom",
      createdAt: new Date().toISOString(),
      homeTeam,
      awayTeam,
      matchDateTime: dateTimeRaw ? new Date(dateTimeRaw).toISOString() : undefined,
      locationClubName: locationClubName || undefined,
      fieldName: fieldName || undefined,
    };
    upsertMatch(metadata);
    void emitMatchMetadataEvent(metadata.id, "match.created", metadataPayload(metadata));
    void emitMatchFormatEvent(metadata.id, periodConfig.periodCount, periodConfig.periodDurationSeconds);
    uiState.selectedMatchId = metadata.id;
    uiState.view = "match";
    uiState.importTarget = "new";
    uiState.importTargetMatchId = undefined;
    localStorage.setItem(selectedMatchIdKey, metadata.id);
    uiState.events = [];
    render();
    void refreshProjection();
  });

  const clubQueryInput = appRoot.querySelector<HTMLInputElement>("#clubQuery");
  clubQueryInput?.addEventListener("input", () => {
    uiState.clubQuery = clubQueryInput.value;
    render();
    const replacement = appRoot.querySelector<HTMLInputElement>("#clubQuery");
    replacement?.focus();
  });

  appRoot.querySelector<HTMLButtonElement>("#loadClubs")?.addEventListener("click", () => {
    void loadKNHBClubs();
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-select-club").forEach((element) => {
    element.addEventListener("click", () => {
      const id = element.dataset.clubId;
      if (!id) return;
      uiState.selectedClubId = id;
      uiState.teams = [];
      uiState.selectedTeamId = "";
      uiState.activeFavoriteKey = undefined;
      uiState.foundMatches = [];
      render();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#loadTeams")?.addEventListener("click", () => {
    if (!uiState.selectedClubId) return;
    void loadKNHBTeams(uiState.selectedClubId);
  });

  const teamSelect = appRoot.querySelector<HTMLSelectElement>("#teamSelect");
  teamSelect?.addEventListener("change", () => {
    uiState.selectedTeamId = teamSelect.value;
    uiState.activeFavoriteKey = undefined;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#loadMatches")?.addEventListener("click", () => {
    if (!uiState.selectedTeamId) return;
    void loadKNHBMatches(uiState.selectedTeamId);
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-load-favorite-team").forEach((element) => {
    element.addEventListener("click", () => {
      const favoriteKey = element.dataset.favoriteKey;
      if (!favoriteKey) return;
      const favorite = uiState.favoriteTeams.find((team) => team.key === favoriteKey);
      if (!favorite) return;
      uiState.selectedClubId = favorite.clubId;
      uiState.selectedTeamId = favorite.teamIds[0] ?? "";
      uiState.activeFavoriteKey = favorite.key;
      render();
      void loadKNHBMatchesForFavorite(favorite);
    });
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-remove-favorite-team").forEach((element) => {
    element.addEventListener("click", () => {
      const favoriteKey = element.dataset.favoriteKey;
      if (!favoriteKey) return;
      removeFavoriteTeam(favoriteKey);
      if (uiState.activeFavoriteKey === favoriteKey) uiState.activeFavoriteKey = undefined;
      render();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#toggleFavoriteTeam")?.addEventListener("click", () => {
    const selected = uiState.teams.find((team) => team.id === uiState.selectedTeamId);
    if (!selected || !uiState.selectedClubId) return;
    const key = favoriteTeamKey(uiState.selectedClubId, selected.name);
    if (isFavoriteTeamKey(key)) {
      removeFavoriteTeam(key);
      if (uiState.activeFavoriteKey === key) uiState.activeFavoriteKey = undefined;
      uiState.output = "Team removed from favorites.";
    } else {
      const selectedClub = uiState.clubs.find((club) => club.id === uiState.selectedClubId);
      const relatedTeamIds = uiState.teams
        .filter((team) => normalizeTeamName(team.name) === normalizeTeamName(selected.name))
        .map((team) => team.id);
      addFavoriteTeam({
        key,
        clubId: uiState.selectedClubId,
        clubName: selectedClub?.abbreviation ?? selectedClub?.name,
        name: selected.name,
        teamIds: relatedTeamIds.length > 0 ? relatedTeamIds : [selected.id],
      });
      uiState.output = "Team added to favorites.";
    }
    render();
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-import-match").forEach((element) => {
    element.addEventListener("click", () => {
      const matchId = element.dataset.knhbMatchId;
      if (!matchId) return;
      const selected = uiState.foundMatches.find((match) => match.id === matchId);
      if (!selected) return;
      void applyImportedMatch(selected);
      render();
      void refreshProjection();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#refreshMenu")?.addEventListener("click", () => {
    uiState.matchMenuOpen = false;
    render();
    void refreshProjection();
  });

  appRoot.querySelector<HTMLButtonElement>("#assignFromKNHB")?.addEventListener("click", () => {
    const selected = getSelectedMatch();
    if (!selected) return;
    uiState.matchMenuOpen = false;
    uiState.metadataModalOpen = false;
    uiState.importTarget = "update";
    uiState.importTargetMatchId = selected.id;
    uiState.view = "create";
    uiState.createMode = "knhb";
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#saveMetadata")?.addEventListener("click", () => {
    const selected = getSelectedMatch();
    if (!selected) return;
    const homeTeam = (appRoot.querySelector<HTMLInputElement>("#editHome")?.value ?? "").trim() || "Home";
    const awayTeam = (appRoot.querySelector<HTMLInputElement>("#editAway")?.value ?? "").trim() || "Away";
    const locationClubName = (appRoot.querySelector<HTMLInputElement>("#editLocationClub")?.value ?? "").trim();
    const fieldName = (appRoot.querySelector<HTMLInputElement>("#editFieldName")?.value ?? "").trim();
    const knhbMatchId = (appRoot.querySelector<HTMLInputElement>("#editKNHBMatchId")?.value ?? "").trim();
    const periodCountRaw = appRoot.querySelector<HTMLInputElement>("#editPeriodCount")?.value ?? "";
    const periodMinutesRaw = appRoot.querySelector<HTMLInputElement>("#editPeriodMinutes")?.value ?? "";
    const periodConfig = parsePeriodConfig(periodCountRaw, periodMinutesRaw);
    const dateTimeRaw = appRoot.querySelector<HTMLInputElement>("#editDateTime")?.value ?? "";
    const updatedMatch: MatchMetadata = {
      ...selected,
      homeTeam,
      awayTeam,
      locationClubName: locationClubName || undefined,
      fieldName: fieldName || undefined,
      knhbMatchId: knhbMatchId || undefined,
      knhbSourceTeamId: selected.knhbSourceTeamId,
      matchDateTime: dateTimeRaw ? new Date(dateTimeRaw).toISOString() : undefined,
    };
    upsertMatch(updatedMatch);
    void emitMatchMetadataEvent(updatedMatch.id, "match.updated", metadataPayload(updatedMatch));
    void emitMatchFormatEvent(updatedMatch.id, periodConfig.periodCount, periodConfig.periodDurationSeconds);
    uiState.metadataModalOpen = false;
    uiState.matchMenuOpen = false;
    uiState.output = "Match metadata saved.";
    render();
    syncLivePanel();
  });

  appRoot.querySelector<HTMLButtonElement>("#refreshKNHBMetadata")?.addEventListener("click", () => {
    const selected = getSelectedMatch();
    if (!selected) return;
    void refreshMatchMetadataFromKNHB(selected);
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-action").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.action;
      if (!action) return;
      void triggerAction(action);
    });
  });
}

void completeAuthRedirect().finally(() => {
  render();
});
initKeyboardShortcuts();
void refreshProjection();
setInterval(() => {
  uiState.liveNowMs = Date.now();
  syncLivePanel();
}, 1000);
setInterval(() => {
  void refreshProjection();
}, 3000);
setInterval(() => {
  void refreshListScores();
}, 5000);
if (uiState.view === "list") {
  void refreshListScores();
}
