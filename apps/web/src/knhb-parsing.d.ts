export type ParsedKNHBMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  dateRaw?: string;
  locationClubName?: string;
  fieldName?: string;
};

export type ImportedMatchMetadata = {
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

export function scalarString(value: unknown): string | undefined;
export function recursiveLookup(value: unknown, allowedLowerKeys: Set<string>): string | undefined;
export function firstString(dict: Record<string, unknown>, keys: string[]): string | undefined;
export function looksLikeDateToken(value: string): boolean;
export function parseTeamsFromDisplay(display: string | undefined): { homeTeam?: string; awayTeam?: string };
export function extractTeamBySide(dict: Record<string, unknown>, side: "home" | "away"): string | undefined;
export function parseKNHBMatchItem(item: Record<string, unknown>): ParsedKNHBMatch | undefined;
export function toImportedMatchMetadata(
  parsed: ParsedKNHBMatch,
  context: { nowIso: string; parsedDateIso?: string; selectedClubName?: string }
): ImportedMatchMetadata;
