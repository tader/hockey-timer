/**
 * @typedef {{
 *   id: string;
 *   homeTeam: string;
 *   awayTeam: string;
 *   dateRaw?: string;
 *   locationClubName?: string;
 *   fieldName?: string;
 * }} ParsedKNHBMatch
 */

/**
 * @typedef {{
 *   id: string;
 *   source: "web-custom" | "knhb" | "local";
 *   createdAt: string;
 *   matchDateTime?: string;
 *   homeTeam: string;
 *   awayTeam: string;
 *   locationClubName?: string;
 *   fieldName?: string;
 *   knhbMatchId?: string;
 * }} ImportedMatchMetadata
 */

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function scalarString(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const dict = /** @type {Record<string, unknown>} */ (value);
    for (const key of ["name", "naam", "teamnaam", "omschrijving", "label", "value", "text"]) {
      const nested = dict[key];
      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    }
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @param {Set<string>} allowedLowerKeys
 * @returns {string|undefined}
 */
export function recursiveLookup(value, allowedLowerKeys) {
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

  const dict = /** @type {Record<string, unknown>} */ (value);
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

/**
 * @param {Record<string, unknown>} dict
 * @param {string[]} keys
 * @returns {string|undefined}
 */
export function firstString(dict, keys) {
  return recursiveLookup(dict, new Set(keys.map((key) => key.toLowerCase())));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeDateToken(value) {
  const token = value.trim();
  if (!token) return false;
  if (/^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{2}-\d{2}-\d{4}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}(?:[ T].*)?$/.test(token)) return true;
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(token)) return true;
  if (token.includes("T") && token.includes("Z")) return true;
  return false;
}

/**
 * @param {string|undefined} display
 * @returns {{homeTeam?: string; awayTeam?: string}}
 */
export function parseTeamsFromDisplay(display) {
  if (!display) return {};
  const normalized = display.trim();
  if (!normalized) return {};

  for (const separator of [" – ", " vs ", " VS ", " - ", " tegen "]) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 2) {
      if (looksLikeDateToken(parts[1])) continue;
      return { homeTeam: parts[0], awayTeam: parts[1] };
    }
  }
  return {};
}

/**
 * @param {Record<string, unknown>} dict
 * @param {"home"|"away"} side
 * @returns {string|undefined}
 */
export function extractTeamBySide(dict, side) {
  const sideTokens =
    side === "home"
      ? ["home", "thuis", "host"]
      : ["away", "uit", "guest"];

  /**
   * @param {unknown} value
   * @returns {string|undefined}
   */
  const walk = (value) => {
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

    const object = /** @type {Record<string, unknown>} */ (value);
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

/**
 * @param {Record<string, unknown>} item
 * @returns {ParsedKNHBMatch|undefined}
 */
export function parseKNHBMatchItem(item) {
  const id = firstString(item, ["id", "matchId", "wedstrijdcode", "wedstrijdnummer", "code"]);
  if (!id) return undefined;
  const displayTitle = firstString(item, ["title", "naam", "name", "omschrijving", "wedstrijd"]);
  const parsedDisplay = parseTeamsFromDisplay(displayTitle);

  const rawHome =
    firstString(item, [
      "homeTeamName", "homeTeam", "teamhome", "teamHome", "thuisteam", "thuisTeam",
      "thuisteamnaam", "home_team_name", "team_thuis", "thuis_team", "home_team", "home_name", "home", "thuis",
    ]) ??
    extractTeamBySide(item, "home") ??
    parsedDisplay.homeTeam;
  const rawAway =
    firstString(item, [
      "awayTeamName", "awayTeam", "teamaway", "teamAway", "uitteam", "uitTeam",
      "uitteamnaam", "away_team_name", "team_uit", "uit_team", "away_team", "away_name", "away", "uit",
    ]) ??
    extractTeamBySide(item, "away") ??
    parsedDisplay.awayTeam;

  const homeTeam = rawHome && !looksLikeDateToken(rawHome) ? rawHome : "Home";
  const awayTeam = rawAway && !looksLikeDateToken(rawAway)
    ? rawAway
    : (parsedDisplay.awayTeam && !looksLikeDateToken(parsedDisplay.awayTeam) ? parsedDisplay.awayTeam : "Away");

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

  return { id, homeTeam, awayTeam, dateRaw, locationClubName, fieldName };
}

/**
 * @param {ParsedKNHBMatch} parsed
 * @param {{ nowIso: string; parsedDateIso?: string; selectedClubName?: string }} context
 * @returns {ImportedMatchMetadata}
 */
export function toImportedMatchMetadata(parsed, context) {
  return {
    id: `knhb-${parsed.id}`,
    source: "knhb",
    createdAt: context.nowIso,
    homeTeam: parsed.homeTeam,
    awayTeam: parsed.awayTeam,
    matchDateTime: context.parsedDateIso,
    locationClubName: parsed.locationClubName ?? context.selectedClubName,
    fieldName: parsed.fieldName,
    knhbMatchId: parsed.id,
  };
}
