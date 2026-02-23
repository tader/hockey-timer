# Product Requirements

## Vision
Create a connected ecosystem of Field Hockey Timer apps that work reliably in real-world conditions, including unstable connectivity and watch constraints.

## Platforms
- Apple Watch app (primary focus)
- iPhone app (companion)
- iPad app (companion/extended UI)
- Web app
- Android phone app
- Android watch app

## Non-Negotiables
- Native platform applications (not one shared cross-platform UI layer).
- Event-based domain model.
- Strong offline behavior, especially on watches.
- Best-effort near-real-time sync with eventual consistency.
- App must be usable without mandatory sign-in.

## Match & Timer Requirements
- Record events such as:
  - Match started
  - Match paused
  - Match resumed
  - Period started/ended
  - Goal +1 for home/away
  - Score correction +/- for home/away
  - Match format changed
- Reconstruct current state by replaying events.
- Support variable match formats:
  - 4 x 17.5 minutes
  - 2 x 20 minutes (indoor)
  - 2 x 35 minutes
  - 4 x 15 minutes
  - Other user-defined period counts/durations
- Allow changing play-time configuration after match start.
- Timer display should show remaining time (countdown) per period.
- When period duration is exceeded, timer should show overtime as elapsed overrun.
- User must be able to end a period even if timer was never started.
- User must be able to end the match explicitly from match controls.

## Data Integration
- Integrate KNHB Match Center endpoints, including examples:
  - `https://publicaties.hockeyweerelt.nl/mc/clubs`
  - `https://publicaties.hockeyweerelt.nl/mc/clubs/${CLUB_ID}/teams`
  - `https://publicaties.hockeyweerelt.nl/mc/teams/{teamId}/matches/upcoming`
- Store KNHB match linkage in match metadata (`knhbMatchId`) when imported.
- Persist match metadata fields for every match:
  - `homeTeam`
  - `awayTeam`
  - optional `matchDateTime`
  - optional `clubName`
  - optional `teamName`
  - optional `knhbMatchId`
- KNHB team selection must disambiguate teams that share the same name across
  competitions (e.g., `zaal` vs `veld`) by showing competition context.
- KNHB data formatting requirements:
  - Club display uses KNHB `abbreviation` when available.
  - Team display in selection uses `${name} (${type})`.
  - Match naming uses `${home_team.name} – ${away_team.name}` (home first).
  - Imported metadata must include `homeTeam`, `awayTeam`, and `knhbMatchId`.
- KNHB datetime handling:
  - Treat KNHB source date/time as UTC.
  - Display KNHB dates/times in `Europe/Amsterdam`.
  - If only date is known and source time is `00:00:00 UTC`, treat time as unknown:
    convert to `Europe/Amsterdam` local date, then display local time as `00:00:00`.

## Match List & Metadata UX
- Users can create custom matches.
- Users can edit match metadata after creation/import.
- Match list should show match date/time.
- Match list should sort newest-first (based on match date/time, fallback to creation time).
- Match list should support filtering by:
  - home team
  - away team
  - club
  - team

## Web/Cloud Direction
- Web stack backed by AWS serverless:
  - API Gateway
  - Lambda
  - DynamoDB
  - Supporting services as needed (auth, observability, queueing)

## Identity, Collaboration, and Permissions
- Authentication is optional at start (anonymous-first usage).
- If a user signs in later, merge anonymous/local match data into the signed-in
  account while preserving event history.
- Multiple users must be able to join the same match/session.
- Join should be easy, including location-assisted discovery.
- Sessions are public by default.
- Permission model:
  - Match creator: `RW` (owner)
  - Joiners: `RO` by default
  - `RW` users can promote others to `RW`

## Planning Constraint
Before implementation:
1. Finalize sync strategy.
2. Finalize architecture and event schema.
3. Finalize phased delivery plan.
