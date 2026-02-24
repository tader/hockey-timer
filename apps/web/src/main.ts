const API_BASE = (globalThis as { __API_BASE__?: string }).__API_BASE__ ?? "http://localhost:8787";
const KNHB_BASE = `${API_BASE}/knhb`;
const matchesKey = "hockey_timer_web_matches";
const selectedMatchIdKey = "hockey_timer_web_selected_match";
const deviceIdKey = "hockey_timer_web_device_id";
const sequenceKey = "hockey_timer_web_sequence";
const favoriteTeamsKey = "hockey_timer_web_favorite_teams";

type MatchEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
  originDeviceId?: string;
  originPlatform?: string;
  sequence?: number;
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
  filterClub: string;
  filterField: string;
  filterSource: string;
  liveNowMs: number;
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("missing #app");
}
const appRoot: HTMLDivElement = root;

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
  filterClub: "",
  filterField: "",
  filterSource: "",
  liveNowMs: Date.now(),
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
  if (match.locationClubName && !isAtHomeLocation(match)) {
    parts.push(match.locationClubName);
  }
  if (match.fieldName) {
    parts.push(match.fieldName);
  }
  return parts.join(" • ");
}

function inferHomeClubFromTeamName(homeTeam: string): string | undefined {
  const token = homeTeam.trim().split(/\s+/)[0];
  if (!token) return undefined;
  return token.replace(/[^A-Za-z0-9-]/g, "").toLowerCase();
}

function isAtHomeLocation(match: MatchMetadata): boolean {
  if (!match.locationClubName) return true;
  const inferred = inferHomeClubFromTeamName(match.homeTeam);
  if (!inferred) return false;
  return match.locationClubName.toLowerCase() === inferred;
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

function applyImportedMatch(selected: KNHBMatch): void {
  const selectedClub = uiState.clubs.find((club) => club.id === uiState.selectedClubId);
  const base: MatchMetadata = {
    id: `knhb-${selected.id}`,
    source: "knhb",
    createdAt: new Date().toISOString(),
    homeTeam: selected.homeTeam,
    awayTeam: selected.awayTeam,
    matchDateTime: parsePossibleDate(selected.dateRaw),
    locationClubName: selected.locationClubName ?? selectedClub?.abbreviation ?? selectedClub?.name,
    fieldName: selected.fieldName,
    knhbMatchId: selected.id,
  };

  if (uiState.importTarget === "update" && uiState.importTargetMatchId) {
    const existing = uiState.matches.find((item) => item.id === uiState.importTargetMatchId);
    if (existing) {
      upsertMatch({
        ...existing,
        source: "knhb",
        homeTeam: base.homeTeam,
        awayTeam: base.awayTeam,
        matchDateTime: base.matchDateTime,
        locationClubName: base.locationClubName,
        fieldName: base.fieldName,
        knhbMatchId: base.knhbMatchId,
      });
      uiState.selectedMatchId = existing.id;
    }
  } else {
    upsertMatch(base);
    uiState.selectedMatchId = base.id;
  }

  localStorage.setItem(selectedMatchIdKey, uiState.selectedMatchId);
  uiState.events = [];
  uiState.view = "match";
  uiState.output = "KNHB metadata applied.";
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

  const response = await fetch(`${API_BASE}/matches/${matchId}/events:batchUpsert`, {
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
  const response = await fetch(`${API_BASE}/matches/${matchId}/events`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`events fetch failed: ${response.status} ${text}`);
  }
  const payload = (await response.json()) as { events?: MatchEvent[] };
  return payload.events ?? [];
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

function renderEventsList(): string {
  if (uiState.events.length === 0) {
    return `<div class="muted">No events yet</div>`;
  }
  return uiState.events
    .map((event) => {
      const payload = summarizePayload(event.payload);
      return `
        <div class="event-item">
          <div><strong>${escapeHtml(event.eventType)}</strong></div>
          <div class="muted">${escapeHtml(formatAmsterdamDateTime(event.occurredAt))}</div>
          ${payload ? `<div class="muted">${escapeHtml(payload)}</div>` : ""}
        </div>
      `;
    })
    .join("");
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

function scalarString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const dict = value as Record<string, unknown>;
    for (const key of ["name", "naam", "teamnaam", "omschrijving", "label", "value", "text"]) {
      const nested = dict[key];
      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    }
  }
  return undefined;
}

function recursiveLookup(value: unknown, allowedLowerKeys: Set<string>): string | undefined {
  if (Array.isArray(value)) {
    for (const nested of value) {
      const found = recursiveLookup(nested, allowedLowerKeys);
      if (found) return found;
    }
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const dict = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(dict)) {
    if (allowedLowerKeys.has(key.toLowerCase())) {
      const found = scalarString(nested);
      if (found) return found;
    }
  }
  for (const nested of Object.values(dict)) {
    const found = recursiveLookup(nested, allowedLowerKeys);
    if (found) return found;
  }
  return undefined;
}

function firstString(dict: Record<string, unknown>, keys: string[]): string | undefined {
  return recursiveLookup(dict, new Set(keys.map((key) => key.toLowerCase())));
}

function parseTeamsFromDisplay(display: string | undefined): { homeTeam?: string; awayTeam?: string } {
  if (!display) return {};
  const normalized = display.trim();
  if (!normalized) return {};

  for (const separator of [" – ", " vs ", " VS ", " - ", " tegen "]) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 2) {
      if (looksLikeDateToken(parts[1])) {
        continue;
      }
      return { homeTeam: parts[0], awayTeam: parts[1] };
    }
  }
  return {};
}

function looksLikeDateToken(value: string): boolean {
  const token = value.trim();
  if (!token) return false;
  if (/^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{2}-\d{2}-\d{4}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(token)) return true;
  if (token.includes("T") && token.includes("Z")) return true;
  return false;
}

function extractTeamBySide(dict: Record<string, unknown>, side: "home" | "away"): string | undefined {
  const sideTokens =
    side === "home"
      ? ["home", "thuis", "host", "h"]
      : ["away", "uit", "guest", "a"];

  const walk = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return undefined;
    }
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const object = value as Record<string, unknown>;
    const sideHint = firstString(object, ["side", "type", "thuisUit", "thuisuit", "rol", "role"]);
    if (sideHint && sideTokens.some((token) => sideHint.toLowerCase().includes(token))) {
      const name = firstString(object, ["name", "naam", "teamnaam", "teamName", "omschrijving", "title"]);
      if (name) return name;
    }

    for (const [key, nested] of Object.entries(object)) {
      const lowered = key.toLowerCase();
      if (sideTokens.some((token) => lowered.includes(token))) {
        const direct = scalarString(nested);
        if (direct) return direct;
      }
    }

    for (const nested of Object.values(object)) {
      const found = walk(nested);
      if (found) return found;
    }
    return undefined;
  };

  return walk(dict);
}

async function fetchKNHBOptions(url: string, preferredNameKeys: string[]): Promise<KNHBOption[]> {
  const response = await fetch(url);
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
    const response = await fetch(`${KNHB_BASE}/clubs/${encodeURIComponent(clubId)}/teams`);
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

async function fetchKNHBMatchesForTeam(teamId: string): Promise<KNHBMatch[]> {
  const response = await fetch(`${KNHB_BASE}/teams/${encodeURIComponent(teamId)}/matches/upcoming`);
  if (!response.ok) {
    throw new Error(`KNHB matches fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const matches: KNHBMatch[] = [];
  for (const item of jsonObjects(payload)) {
    const id = firstString(item, ["id", "matchId", "wedstrijdcode", "wedstrijdnummer", "code"]);
    if (!id) continue;
    const displayTitle = firstString(item, ["title", "naam", "name", "omschrijving", "wedstrijd"]);
    const parsedDisplay = parseTeamsFromDisplay(displayTitle);

    const homeTeam =
      firstString(item, [
        "homeTeamName", "homeTeam", "teamhome", "teamHome", "thuisteam", "thuisTeam",
        "thuisteamnaam", "home_team_name", "team_thuis", "thuis_team", "home_name", "home", "thuis",
      ]) ??
      extractTeamBySide(item, "home") ??
      parsedDisplay.homeTeam ??
      "Home";
    const awayTeam =
      firstString(item, [
        "awayTeamName", "awayTeam", "teamaway", "teamAway", "uitteam", "uitTeam",
        "uitteamnaam", "away_team_name", "team_uit", "uit_team", "away_name", "away", "uit",
      ]) ??
      extractTeamBySide(item, "away") ??
      parsedDisplay.awayTeam ??
      "Away";
    const dateRaw = firstString(item, [
      "date", "datum", "startDateTime", "start", "starttime", "starttijd", "aanvang", "aanvangstijd",
      "plannedStart", "beginDateTime", "speeldatum", "datetime",
    ]);
    const locationClubName = firstString(item, [
      "locationClub", "club", "clubnaam", "location", "speellocatie", "accommodatie", "venueClub",
    ]);
    const fieldName = firstString(item, [
      "field", "fieldName", "veld", "veldnaam", "pitch", "court", "zaal",
    ]);
    matches.push({ id, homeTeam, awayTeam, dateRaw, locationClubName, fieldName });
  }
  return matches;
}

function dedupeMatches(matches: KNHBMatch[]): KNHBMatch[] {
  const byId = new Map<string, KNHBMatch>();
  for (const match of matches) {
    byId.set(match.id, match);
  }
  return Array.from(byId.values());
}

async function loadKNHBMatches(teamId: string): Promise<void> {
  uiState.loading = true;
  render();
  try {
    const matches = await fetchKNHBMatchesForTeam(teamId);
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
      const response = await fetch(`${KNHB_BASE}/clubs/${encodeURIComponent(favorite.clubId)}/teams`);
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
    const all = await Promise.all(relatedTeamIds.map((teamId) => fetchKNHBMatchesForTeam(teamId)));
    uiState.foundMatches = dedupeMatches(all.flat());
    uiState.output = `Loaded ${uiState.foundMatches.length} upcoming matches`;
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
    club: uiState.filterClub.trim().toLowerCase(),
    field: uiState.filterField.trim().toLowerCase(),
    source: uiState.filterSource.trim().toLowerCase(),
  };
  const filtered = uiState.matches.filter((match) => {
    if (normalized.home && !match.homeTeam.toLowerCase().includes(normalized.home)) return false;
    if (normalized.away && !match.awayTeam.toLowerCase().includes(normalized.away)) return false;
    if (normalized.club && !(match.locationClubName ?? "").toLowerCase().includes(normalized.club)) return false;
    if (normalized.field && !(match.fieldName ?? "").toLowerCase().includes(normalized.field)) return false;
    if (normalized.source && !match.source.toLowerCase().includes(normalized.source)) return false;
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
          <button id="newMatch">New Match</button>
          <button id="quickMatchList" class="ghost">Quick Match</button>
        </div>
      </div>
      <div class="filters-grid">
        <input id="filterHome" placeholder="Filter home" value="${escapeHtml(uiState.filterHome)}" />
        <input id="filterAway" placeholder="Filter away" value="${escapeHtml(uiState.filterAway)}" />
        <input id="filterClub" placeholder="Filter location club" value="${escapeHtml(uiState.filterClub)}" />
        <input id="filterField" placeholder="Filter field" value="${escapeHtml(uiState.filterField)}" />
        <input id="filterSource" placeholder="Filter source" value="${escapeHtml(uiState.filterSource)}" />
      </div>
      <div class="table-wrap">
        <table class="matches-table">
          <thead>
            <tr>
              <th><button class="table-sort js-sort" data-field="homeTeam">Home</button></th>
              <th><button class="table-sort js-sort" data-field="awayTeam">Away</button></th>
              <th><button class="table-sort js-sort" data-field="matchDateTime">Date</button></th>
              <th><button class="table-sort js-sort" data-field="locationClubName">Location Club</button></th>
              <th><button class="table-sort js-sort" data-field="fieldName">Field</button></th>
              <th><button class="table-sort js-sort" data-field="source">Source</button></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((match) => `
              <tr class="js-open-match" data-match-id="${escapeHtml(match.id)}">
                <td>${escapeHtml(match.homeTeam)}</td>
                <td>${escapeHtml(match.awayTeam)}</td>
                <td>${escapeHtml(formatAmsterdamDate(match.matchDateTime ?? match.createdAt) ?? "Unknown")}</td>
                <td>${escapeHtml(isAtHomeLocation(match) ? "" : (match.locationClubName ?? ""))}</td>
                <td>${escapeHtml(match.fieldName ?? "")}</td>
                <td>${escapeHtml(match.source)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
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
              <input id="createLocationClub" type="text" placeholder="Location club (optional)" />
              <input id="createFieldName" type="text" placeholder="Field name (optional)" />
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
  const timer = timerFromLocalProjection(local);
  const stateLabel = local.isEnded ? "ENDED" : local.isRunning ? "RUNNING" : "PAUSED";
  return `
    <section class="card">
      <div class="title-row">
        <button id="backToList" class="ghost">Back To Matches (Esc)</button>
        <span class="muted">${escapeHtml(match.id)}</span>
      </div>
      <h2>${escapeHtml(matchTitle(match))}</h2>
      <p class="muted">${escapeHtml(matchSubtitle(match) || "No metadata")}</p>
      <div class="scoreboard">
        <div class="team-score">
          <div class="team-label">Home</div>
          <div id="scoreHome" class="score-number">${local.homeScore}</div>
        </div>
        <div class="clock-panel">
          <div id="liveClock" class="clock ${timer.isOverrun ? "overrun" : ""}">${escapeHtml(timer.label)}</div>
          <div id="liveState" class="state-pill">${stateLabel}</div>
          <div id="livePeriod" class="muted">Period ${local.currentPeriod}</div>
        </div>
        <div class="team-score">
          <div class="team-label">Away</div>
          <div id="scoreAway" class="score-number">${local.awayScore}</div>
        </div>
      </div>
      <div class="control-grid">
        <button class="js-action" data-action="start">Start <kbd>S</kbd></button>
        <button class="js-action" data-action="pause">Pause <kbd>Space</kbd></button>
        <button class="js-action" data-action="resume">Resume <kbd>Space</kbd></button>
        <button class="js-action" data-action="endPeriod">End Period <kbd>E</kbd></button>
        <button class="js-action" data-action="previousPeriod">Previous Period <kbd>P</kbd></button>
        <button class="js-action" data-action="clockReset">Reset Clock <kbd>0</kbd></button>
        <button class="js-action" data-action="clockMinus60">-60s <kbd>,</kbd></button>
        <button class="js-action" data-action="clockPlus60">+60s <kbd>.</kbd></button>
        <button class="js-action" data-action="clockMinus10">-10s <kbd>&lt;</kbd></button>
        <button class="js-action" data-action="clockPlus10">+10s <kbd>&gt;</kbd></button>
        <button class="js-action danger" data-action="endMatch">End Match <kbd>M</kbd></button>
        <button class="js-action" data-action="homePlus">Home +1 <kbd>H</kbd></button>
        <button class="js-action" data-action="awayPlus">Away +1 <kbd>A</kbd></button>
        <button class="js-action" data-action="homeMinus">Home -1 <kbd>Shift+H</kbd></button>
        <button class="js-action" data-action="awayMinus">Away -1 <kbd>Shift+A</kbd></button>
        <button id="poll">Refresh <kbd>R</kbd></button>
      </div>
      <section class="card">
        <div class="title-row">
          <h3>Match Metadata</h3>
          <button id="assignFromKNHB" class="ghost">Import/Assign KNHB</button>
        </div>
        <div class="filters-grid">
          <input id="editHome" value="${escapeHtml(match.homeTeam)}" placeholder="Home team" />
          <input id="editAway" value="${escapeHtml(match.awayTeam)}" placeholder="Away team" />
          <input id="editLocationClub" value="${escapeHtml(match.locationClubName ?? "")}" placeholder="Location club" />
          <input id="editFieldName" value="${escapeHtml(match.fieldName ?? "")}" placeholder="Field name" />
          <input id="editKNHBMatchId" value="${escapeHtml(match.knhbMatchId ?? "")}" placeholder="KNHB Match ID" />
        </div>
        <div class="row">
          <label for="editDateTime" class="muted">Match date/time (Europe/Amsterdam)</label>
          <input id="editDateTime" type="datetime-local" value="${escapeHtml(formatForDateTimeLocal(match.matchDateTime))}" />
          <button id="saveMetadata">Save Metadata</button>
        </div>
      </section>
      <h3>Events</h3>
      <div id="liveEvents" class="events-list">${renderEventsList()}</div>
      <pre id="liveOutput">${escapeHtml(uiState.loading ? "Loading..." : uiState.output)}</pre>
    </section>
  `;
}

function render(): void {
  const selectedMatch = getSelectedMatch();
  const body = uiState.view === "match" && selectedMatch
    ? renderMatchView(selectedMatch)
    : uiState.view === "create"
      ? renderCreateView()
      : renderListView();

  appRoot.innerHTML = `
    <h1>Hockey Timer</h1>
    <p class="muted">List-first workflow with full keyboard control in match view.</p>
    ${body}
  `;
  wireHandlers();
}

function syncLivePanel(): void {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch || uiState.view !== "match") return;
  const local = replayKnownEvents(uiState.events, uiState.liveNowMs);
  const timer = timerFromLocalProjection(local);
  const scoreHome = appRoot.querySelector<HTMLElement>("#scoreHome");
  const scoreAway = appRoot.querySelector<HTMLElement>("#scoreAway");
  const state = appRoot.querySelector<HTMLElement>("#liveState");
  const period = appRoot.querySelector<HTMLElement>("#livePeriod");
  const clock = appRoot.querySelector<HTMLElement>("#liveClock");
  const output = appRoot.querySelector<HTMLElement>("#liveOutput");
  const events = appRoot.querySelector<HTMLElement>("#liveEvents");

  if (scoreHome) scoreHome.textContent = String(local.homeScore);
  if (scoreAway) scoreAway.textContent = String(local.awayScore);
  if (state) state.textContent = local.isEnded ? "ENDED" : local.isRunning ? "RUNNING" : "PAUSED";
  if (period) period.textContent = `Period ${local.currentPeriod}`;
  if (clock) {
    clock.textContent = timer.label;
    clock.classList.toggle("overrun", timer.isOverrun);
  }
  if (output) output.textContent = uiState.loading ? "Loading..." : uiState.output;
  if (events) events.innerHTML = renderEventsList();
}

async function triggerAction(action: string): Promise<void> {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch) return;

  const local = replayKnownEvents(uiState.events, Date.now());
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
    if (event.key === "Escape") {
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
      const hasStarted = uiState.events.some((item) => item.eventType === "match.started");
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
  appRoot.querySelectorAll<HTMLElement>(".js-open-match").forEach((element) => {
    element.addEventListener("click", () => {
      const id = element.dataset.matchId;
      if (!id) return;
      uiState.selectedMatchId = id;
      localStorage.setItem(selectedMatchIdKey, id);
      uiState.events = [];
      uiState.view = "match";
      render();
      void refreshProjection();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#backToList")?.addEventListener("click", () => {
    uiState.view = "list";
    uiState.importTarget = "new";
    uiState.importTargetMatchId = undefined;
    render();
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
    ["filterHome", "filterHome"],
    ["filterAway", "filterAway"],
    ["filterClub", "filterClub"],
    ["filterField", "filterField"],
    ["filterSource", "filterSource"],
  ] as const) {
    const input = appRoot.querySelector<HTMLInputElement>(`#${id}`);
    input?.addEventListener("input", () => {
      uiState[key] = input.value;
      render();
    });
  }

  appRoot.querySelector<HTMLButtonElement>("#newMatch")?.addEventListener("click", () => {
    uiState.view = "create";
    uiState.createMode = "knhb";
    uiState.importTarget = "new";
    uiState.importTargetMatchId = undefined;
    render();
  });

  appRoot.querySelector<HTMLButtonElement>("#quickMatchList")?.addEventListener("click", () => {
    const metadata = createQuickMatch();
    upsertMatch(metadata);
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
      applyImportedMatch(selected);
      render();
      void refreshProjection();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("#poll")?.addEventListener("click", () => {
    void refreshProjection();
  });

  appRoot.querySelector<HTMLButtonElement>("#assignFromKNHB")?.addEventListener("click", () => {
    const selected = getSelectedMatch();
    if (!selected) return;
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
    const dateTimeRaw = appRoot.querySelector<HTMLInputElement>("#editDateTime")?.value ?? "";
    upsertMatch({
      ...selected,
      homeTeam,
      awayTeam,
      locationClubName: locationClubName || undefined,
      fieldName: fieldName || undefined,
      knhbMatchId: knhbMatchId || undefined,
      matchDateTime: dateTimeRaw ? new Date(dateTimeRaw).toISOString() : undefined,
    });
    uiState.output = "Match metadata saved.";
    render();
    syncLivePanel();
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-action").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.action;
      if (!action) return;
      void triggerAction(action);
    });
  });
}

render();
initKeyboardShortcuts();
void refreshProjection();
setInterval(() => {
  uiState.liveNowMs = Date.now();
  syncLivePanel();
}, 1000);
setInterval(() => {
  void refreshProjection();
}, 3000);
