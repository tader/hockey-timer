# KNHB Integration (Draft)

## Goal
Import/reference match metadata from KNHB Match Center so users can select upcoming matches and prefill context.

## Known Endpoints (Provided)
- `https://publicaties.hockeyweerelt.nl/mc/clubs`
- `https://publicaties.hockeyweerelt.nl/mc/clubs/${CLUB_ID}/teams`
- `https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/upcoming`

## Initial Integration Approach
- Build backend proxy/adaptor layer in Lambda:
  - isolates clients from endpoint changes
  - centralizes retries/caching/rate-limits
  - supports schema normalization
- Normalize KNHB entities to internal models:
  - `Club`
  - `Team`
  - `ScheduledMatch`

## Data Mapping Rules (Agreed)
- Club display:
  - Use KNHB `abbreviation` when available.
  - Fallback to full club name if abbreviation is missing.
- Team display in selectors:
  - Format as `${name} (${type})`.
  - `type` is the KNHB team/competition type (for example `zaal` or `veld`).
- Match title:
  - Format as `${home_team.name} – ${away_team.name}` (home first).
  - Avoid placeholder labels such as `Home` / `Away` unless source data truly lacks team names.
- Match metadata persistence:
  - Persist `homeTeam`, `awayTeam`, and `knhbMatchId` for imported matches.
- Team favorites:
  - Users can mark/unmark KNHB teams as favorites.
  - Favorites are stored locally per device for quick team re-selection.

## Date/Time Rules (Agreed)
- KNHB datetimes are treated as UTC source values.
- Always convert KNHB datetime display to `Europe/Amsterdam` local time.
- UI shows KNHB match date only (no time) even when source time is known.
- If KNHB provides date-only values represented as `00:00:00 UTC`:
  - treat these records as `time unknown`,
  - convert the UTC source instant to `Europe/Amsterdam` local date,
  - display only that local date.

## Caching Strategy (Draft)
- Cache club/team listings with TTL (longer).
- Cache upcoming matches with shorter TTL.
- Add manual refresh option from clients.

## Failure Handling
- If KNHB unavailable:
  - allow manual match setup/editing
  - keep timer functionality independent of KNHB access

## Open Questions
1. Is authentication required for all target KNHB resources?
2. Expected rate limits and acceptable cache staleness?
3. Which KNHB fields are authoritative vs user-editable locally?
