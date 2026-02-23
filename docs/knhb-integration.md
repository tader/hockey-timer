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

