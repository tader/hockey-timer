const API_BASE = (globalThis as { __API_BASE__?: string }).__API_BASE__ ?? "http://localhost:8787";
const KNHB_BASE = `${API_BASE}/knhb`;
const matchesKey = "hockey_timer_web_matches";
const selectedMatchIdKey = "hockey_timer_web_selected_match";
const deviceIdKey = "hockey_timer_web_device_id";
const sequenceKey = "hockey_timer_web_sequence";
const favoriteTeamsKey = "hockey_timer_web_favorite_teams";

type Projection = {
  homeScore: number;
  awayScore: number;
  isRunning: boolean;
  isEnded: boolean;
  currentPeriod: number;
  currentPeriodPlayedSeconds: number;
  format: {
    periodCount: number;
    periodDurationSeconds: number[];
  };
  lastEventAt?: string;
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

type MatchMetadata = {
  id: string;
  source: "web-custom" | "knhb" | "local";
  createdAt: string;
  matchDateTime?: string;
  homeTeam: string;
  awayTeam: string;
  clubName?: string;
  teamName?: string;
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
  projection: Projection | null;
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
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("missing #app");
}
const appRoot: HTMLDivElement = root;

const uiState: UIState = {
  matches: loadMatches(),
  selectedMatchId: "",
  projection: null,
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
};

if (uiState.matches.length === 0) {
  const demo: MatchMetadata = {
    id: "demo-match",
    source: "local",
    createdAt: new Date().toISOString(),
    matchDateTime: new Date().toISOString(),
    homeTeam: "Home",
    awayTeam: "Away",
    clubName: "Demo Club",
    teamName: "Demo Team",
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
  if (match.clubName) {
    parts.push(match.clubName);
  }
  if (match.teamName) {
    parts.push(match.teamName);
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
    return parsed.filter((item): item is MatchMetadata => {
      return !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string";
    });
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

async function fetchProjection(matchId: string): Promise<Projection> {
  const response = await fetch(`${API_BASE}/matches/${matchId}/projection`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`projection fetch failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<Projection>;
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

function periodTimerDisplay(projection: Projection): { label: string; isOverrun: boolean } {
  const periodIndex = Math.max(0, projection.currentPeriod - 1);
  const configured = projection.format.periodDurationSeconds[periodIndex] ?? 0;
  const remaining = configured - projection.currentPeriodPlayedSeconds;

  if (remaining >= 0) {
    return { label: `${formatClock(remaining)} remaining`, isOverrun: false };
  }

  return { label: `+${formatClock(Math.abs(remaining))} over`, isOverrun: true };
}

async function refreshProjection(): Promise<void> {
  const selectedMatch = getSelectedMatch();
  if (!selectedMatch) return;
  const targetMatchId = selectedMatch.id;
  try {
    const [projection, events] = await Promise.all([
      fetchProjection(targetMatchId),
      fetchEvents(targetMatchId),
    ]);
    if (uiState.selectedMatchId !== targetMatchId) {
      return;
    }
    uiState.projection = projection;
    uiState.events = events;
    uiState.output = `Last update: ${new Date().toLocaleTimeString()} (event: ${projection.lastEventAt ?? "none"})`;
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
    matches.push({ id, homeTeam, awayTeam, dateRaw });
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

function render(): void {
  const selectedMatch = getSelectedMatch();
  const projection = uiState.projection;
  const timer = projection ? periodTimerDisplay(projection) : { label: "00:00 remaining", isOverrun: false };
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

  appRoot.innerHTML = `
    <h1>Hockey Timer Web</h1>
    <p>Web-first feature set: matches list, custom creation, KNHB import, and live match control.</p>
    <div class="layout">
      <section class="card sidebar">
        <h2>Matches</h2>
        <div class="match-list">
          ${sortedMatches(uiState.matches)
            .map((match) => {
              const activeClass = match.id === uiState.selectedMatchId ? "active" : "";
              return `
                <button class="match-item ${activeClass} js-select-match" data-match-id="${escapeHtml(match.id)}">
                  <span class="match-title">${escapeHtml(matchTitle(match))}</span>
                  <span class="match-subtitle">${escapeHtml(matchSubtitle(match) || "No metadata")}</span>
                </button>
              `;
            })
            .join("")}
        </div>

        <h3>Create Match</h3>
        <div class="stack">
          <input id="createHome" type="text" placeholder="Home team" />
          <input id="createAway" type="text" placeholder="Away team" />
          <input id="createClub" type="text" placeholder="Club (optional)" />
          <input id="createTeam" type="text" placeholder="Team (optional)" />
          <label for="createDateTime">Match date/time (optional)</label>
          <input id="createDateTime" type="datetime-local" />
          <button id="createMatch">Create Match</button>
        </div>

        <h3>Import KNHB</h3>
        <div class="stack">
          <h4>Favorite Teams</h4>
          <div class="club-results">
            ${
              uiState.favoriteTeams.length === 0
                ? `<div class="muted">No favorite teams yet</div>`
                : uiState.favoriteTeams
                    .map((team) => `
                      <div class="found-match">
                        <div><strong>${escapeHtml(team.name)}</strong>${team.clubName ? ` <span class="muted">(${escapeHtml(team.clubName)})</span>` : ""}</div>
                        <div class="row">
                          <button class="js-load-favorite-team" data-favorite-key="${escapeHtml(team.key)}">Load Matches</button>
                          <button class="js-remove-favorite-team" data-favorite-key="${escapeHtml(team.key)}">Unfavorite</button>
                        </div>
                      </div>
                    `)
                    .join("")
            }
          </div>
          <button id="loadClubs">Load Clubs</button>
          <input id="clubQuery" type="text" placeholder="Search club" value="${escapeHtml(uiState.clubQuery)}" />
          <div class="club-results">
            ${filteredClubs
              .slice(0, 25)
              .map((club) => {
                const selected = club.id === uiState.selectedClubId ? "selected" : "";
                const subtitle = club.subtitle ? ` (${escapeHtml(club.subtitle)})` : "";
                const clubLabel = club.abbreviation ?? club.name;
                return `<button class="js-select-club ${selected}" data-club-id="${escapeHtml(club.id)}">${escapeHtml(clubLabel)}${subtitle}</button>`;
              })
              .join("")}
          </div>
          <button id="loadTeams" ${uiState.selectedClubId ? "" : "disabled"}>Load Teams</button>
          <select id="teamSelect" ${uiState.teams.length > 0 ? "" : "disabled"}>
            <option value="">Choose team</option>
            ${uiState.teams
              .map((team) => {
                const selected = team.id === uiState.selectedTeamId ? "selected" : "";
                const subtitle = team.subtitle ? ` (${team.subtitle})` : "";
                return `<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.name + subtitle)}</option>`;
              })
              .join("")}
          </select>
          ${
            selectedTeam
              ? `<button id="toggleFavoriteTeam">${selectedTeamIsFavorite ? "Unfavorite Team" : "Favorite Team"}</button>`
              : ""
          }
          <button id="loadMatches" ${uiState.selectedTeamId ? "" : "disabled"}>Load Upcoming Matches</button>
          <div class="found-matches">
            ${uiState.foundMatches
              .map((match) => {
                const parsed = parsePossibleDate(match.dateRaw);
                const label = parsed ? (formatAmsterdamDate(parsed) ?? "Date unknown") : "Date unknown";
                return `
                  <div class="found-match">
                    <div><strong>${escapeHtml(match.homeTeam)} – ${escapeHtml(match.awayTeam)}</strong></div>
                    <div class="muted">${escapeHtml(label)}</div>
                    <button class="js-import-match" data-knhb-match-id="${escapeHtml(match.id)}">Import</button>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Live Match</h2>
        ${
          selectedMatch
            ? `
              <p>Match: <strong>${escapeHtml(selectedMatch.id)}</strong></p>
              <p><strong>${escapeHtml(matchTitle(selectedMatch))}</strong></p>
              <p>${escapeHtml(matchSubtitle(selectedMatch) || "No metadata")}</p>
              <p>Source: <strong>${escapeHtml(selectedMatch.source)}</strong></p>
              ${selectedMatch.knhbMatchId ? `<p>KNHB Match ID: <strong>${escapeHtml(selectedMatch.knhbMatchId)}</strong></p>` : ""}
              <p id="liveScore">Score: <strong>Home ${projection?.homeScore ?? 0} - ${projection?.awayScore ?? 0} Away</strong></p>
              <p id="liveState">State: <strong>${projection ? (projection.isEnded ? "ENDED" : projection.isRunning ? "RUNNING" : "PAUSED") : "PAUSED"}</strong></p>
              <p id="livePeriod">Period: <strong>P${projection?.currentPeriod ?? 1}</strong></p>
              <p id="liveClock">Time: <strong class="${timer.isOverrun ? "overrun" : ""}">${escapeHtml(timer.label)}</strong></p>
              <div class="row">
                <button class="js-action" data-action="start">Start</button>
                <button class="js-action" data-action="pause">Pause</button>
                <button class="js-action" data-action="resume">Resume</button>
                <button class="js-action" data-action="endPeriod">End Period</button>
                <button class="js-action" data-action="endMatch">End Match</button>
              </div>
              <div class="row">
                <button class="js-action" data-action="homePlus">+ Home</button>
                <button class="js-action" data-action="awayPlus">+ Away</button>
                <button class="js-action" data-action="homeMinus">- Home</button>
                <button class="js-action" data-action="awayMinus">- Away</button>
              </div>
              <div class="row">
                <button id="poll">Poll Now</button>
              </div>
              <h3>Events</h3>
              <div id="liveEvents" class="events-list">${renderEventsList()}</div>
            `
            : "<p>No match selected.</p>"
        }
        <pre id="liveOutput">${escapeHtml(uiState.loading ? "Loading..." : uiState.output)}</pre>
      </section>
    </div>
  `;

  wireHandlers();
}

function syncLivePanel(): void {
  const projection = uiState.projection;
  const timer = projection ? periodTimerDisplay(projection) : { label: "00:00 remaining", isOverrun: false };

  const score = appRoot.querySelector<HTMLElement>("#liveScore");
  if (score) {
    score.innerHTML = `Score: <strong>Home ${projection?.homeScore ?? 0} - ${projection?.awayScore ?? 0} Away</strong>`;
  }

  const state = appRoot.querySelector<HTMLElement>("#liveState");
  if (state) {
    const stateLabel = projection ? (projection.isEnded ? "ENDED" : projection.isRunning ? "RUNNING" : "PAUSED") : "PAUSED";
    state.innerHTML = `State: <strong>${stateLabel}</strong>`;
  }

  const period = appRoot.querySelector<HTMLElement>("#livePeriod");
  if (period) {
    period.innerHTML = `Period: <strong>P${projection?.currentPeriod ?? 1}</strong>`;
  }

  const clock = appRoot.querySelector<HTMLElement>("#liveClock");
  if (clock) {
    clock.innerHTML = `Time: <strong class="${timer.isOverrun ? "overrun" : ""}">${escapeHtml(timer.label)}</strong>`;
  }

  const output = appRoot.querySelector<HTMLElement>("#liveOutput");
  if (output) {
    output.textContent = uiState.loading ? "Loading..." : uiState.output;
  }

  const events = appRoot.querySelector<HTMLElement>("#liveEvents");
  if (events) {
    events.innerHTML = renderEventsList();
  }
}

function wireHandlers(): void {
  appRoot.querySelectorAll<HTMLButtonElement>(".js-select-match").forEach((element) => {
    element.addEventListener("click", () => {
      const id = element.dataset.matchId;
      if (!id) return;
      uiState.selectedMatchId = id;
      localStorage.setItem(selectedMatchIdKey, id);
      uiState.projection = null;
      uiState.events = [];
      uiState.output = "Match selected.";
      render();
      void refreshProjection();
    });
  });

  const createButton = appRoot.querySelector<HTMLButtonElement>("#createMatch");
  createButton?.addEventListener("click", () => {
    const homeTeam = (appRoot.querySelector<HTMLInputElement>("#createHome")?.value ?? "").trim() || "Home";
    const awayTeam = (appRoot.querySelector<HTMLInputElement>("#createAway")?.value ?? "").trim() || "Away";
    const clubName = (appRoot.querySelector<HTMLInputElement>("#createClub")?.value ?? "").trim();
    const teamName = (appRoot.querySelector<HTMLInputElement>("#createTeam")?.value ?? "").trim();
    const dateTimeRaw = appRoot.querySelector<HTMLInputElement>("#createDateTime")?.value ?? "";
    const metadata: MatchMetadata = {
      id: `web-${crypto.randomUUID().toLowerCase()}`,
      source: "web-custom",
      createdAt: new Date().toISOString(),
      homeTeam,
      awayTeam,
      matchDateTime: dateTimeRaw ? new Date(dateTimeRaw).toISOString() : undefined,
      clubName: clubName || undefined,
      teamName: teamName || undefined,
    };
    upsertMatch(metadata);
    uiState.selectedMatchId = metadata.id;
    localStorage.setItem(selectedMatchIdKey, metadata.id);
    uiState.projection = null;
    uiState.output = "Custom match created.";
    render();
    void refreshProjection();
  });

  const clubQueryInput = appRoot.querySelector<HTMLInputElement>("#clubQuery");
  clubQueryInput?.addEventListener("input", () => {
    const selectionStart = clubQueryInput.selectionStart ?? clubQueryInput.value.length;
    const selectionEnd = clubQueryInput.selectionEnd ?? clubQueryInput.value.length;
    uiState.clubQuery = clubQueryInput.value;
    render();
    const replacement = appRoot.querySelector<HTMLInputElement>("#clubQuery");
    if (replacement) {
      replacement.focus();
      replacement.setSelectionRange(selectionStart, selectionEnd);
    }
  });

  const loadClubsButton = appRoot.querySelector<HTMLButtonElement>("#loadClubs");
  loadClubsButton?.addEventListener("click", () => {
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

  const loadTeamsButton = appRoot.querySelector<HTMLButtonElement>("#loadTeams");
  loadTeamsButton?.addEventListener("click", () => {
    if (!uiState.selectedClubId) return;
    void loadKNHBTeams(uiState.selectedClubId);
  });

  const teamSelect = appRoot.querySelector<HTMLSelectElement>("#teamSelect");
  teamSelect?.addEventListener("change", () => {
    uiState.selectedTeamId = teamSelect.value;
    uiState.activeFavoriteKey = undefined;
    render();
  });

  const loadMatchesButton = appRoot.querySelector<HTMLButtonElement>("#loadMatches");
  loadMatchesButton?.addEventListener("click", () => {
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
      if (uiState.activeFavoriteKey === favoriteKey) {
        uiState.activeFavoriteKey = undefined;
      }
      render();
    });
  });

  const toggleFavoriteButton = appRoot.querySelector<HTMLButtonElement>("#toggleFavoriteTeam");
  toggleFavoriteButton?.addEventListener("click", () => {
    const selected = uiState.teams.find((team) => team.id === uiState.selectedTeamId);
    if (!selected || !uiState.selectedClubId) return;
    const key = favoriteTeamKey(uiState.selectedClubId, selected.name);
    if (isFavoriteTeamKey(key)) {
      removeFavoriteTeam(key);
      if (uiState.activeFavoriteKey === key) {
        uiState.activeFavoriteKey = undefined;
      }
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

      const selectedClub = uiState.clubs.find((club) => club.id === uiState.selectedClubId);
      const selectedTeam = uiState.teams.find((team) => team.id === uiState.selectedTeamId);
      const selectedFavorite = uiState.favoriteTeams.find((team) => team.key === uiState.activeFavoriteKey);
      const metadata: MatchMetadata = {
        id: `knhb-${selected.id}`,
        source: "knhb",
        createdAt: new Date().toISOString(),
        homeTeam: selected.homeTeam,
        awayTeam: selected.awayTeam,
        matchDateTime: parsePossibleDate(selected.dateRaw),
        clubName: selectedClub?.abbreviation ?? selectedClub?.name,
        teamName: selectedFavorite?.name ?? selectedTeam?.name,
        knhbMatchId: selected.id,
      };
      upsertMatch(metadata);
      uiState.selectedMatchId = metadata.id;
      localStorage.setItem(selectedMatchIdKey, metadata.id);
      uiState.projection = null;
      uiState.output = "KNHB match imported.";
      render();
      void refreshProjection();
    });
  });

  const pollButton = appRoot.querySelector<HTMLButtonElement>("#poll");
  pollButton?.addEventListener("click", () => {
    void refreshProjection();
  });

  appRoot.querySelectorAll<HTMLButtonElement>(".js-action").forEach((element) => {
    element.addEventListener("click", async () => {
      const action = element.dataset.action;
      const selectedMatch = getSelectedMatch();
      if (!action || !selectedMatch) return;

      const actionToEvent: Record<string, { eventType: string; payload: Record<string, string | number> | object }> = {
        start: { eventType: "match.started", payload: {} },
        pause: { eventType: "match.paused", payload: {} },
        resume: { eventType: "match.resumed", payload: {} },
        endPeriod: { eventType: "period.ended", payload: {} },
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
    });
  });
}

render();
void refreshProjection();
setInterval(() => {
  void refreshProjection();
}, 3000);
