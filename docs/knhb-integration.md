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

## Date/Time Rules (Agreed)
- KNHB datetimes are treated as UTC source values.
- Display KNHB match date/time in `Europe/Amsterdam` time zone for convenience.
- If KNHB provides date-only values represented as `00:00:00 UTC`, display conversion must still be done in `Europe/Amsterdam` local time.
  - Example: `2026-03-22 00:00:00 UTC` should display as local date on `2026-03-23` in UI.

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
