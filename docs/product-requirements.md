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
- Web match-view time controls should be ordered for operational flow:
  - row 1: one primary control that changes by state (`Start`/`Pause`/`Resume`)
  - this primary control reads `Start` before first clock start, and appears red while clock is running (pause action)
  - row 2: `Reset Clock`, plus `End Match` only while the game is paused
  - timer/status block
  - row 3: `+ Period`, `+ 1:00`, `+ 0:10`
  - row 4: `- Period`, `- 1:00`, `- 0:10`
- In web match view, `Refresh` should be available from the kebab menu.

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
  - optional `locationClubName`
  - optional `fieldName`
  - optional `knhbMatchId`
  - optional `knhbSourceTeamId` (source team used for KNHB refresh)
- KNHB team selection must disambiguate teams that share the same name across
  competitions (e.g., `zaal` vs `veld`) by showing competition context.
- Users can favorite/unfavorite KNHB teams for quick access.
- Favorite teams should be persisted locally and provide a fast path to load
  upcoming matches without re-browsing clubs.
- Teams with the same name in the same club but different type (e.g. `Veld`/`Zaal`)
  must be treated as one logical favorite:
  - favoriting one favorites the logical team,
  - favorites are shown without type suffix,
  - loading a favorite shows merged matches from both types.
- KNHB data formatting requirements:
  - Club display uses KNHB `abbreviation` when available.
  - Team display in selection uses `${name} (${type})`.
  - Match naming uses `${home_team.name} – ${away_team.name}` (home first).
  - Imported metadata must include `homeTeam`, `awayTeam`, and `knhbMatchId`.
- KNHB datetime handling:
  - Treat KNHB source date/time as UTC.
  - Always convert KNHB display to `Europe/Amsterdam`.
  - Show KNHB match date only in UI (no time), even when source time is known.
  - If only date is known and source time is `00:00:00 UTC`, treat time as unknown:
    convert to `Europe/Amsterdam` local date and display that local date.

## Match List & Metadata UX
- Users can create custom matches.
- Users can edit match metadata after creation/import.
- Match list should show match date (local, Europe/Amsterdam).
- Match list should sort newest-first (based on match date/time, fallback to creation time).
- Match list should support filtering by:
  - team (matches home or away)
  - home team
  - away team
  - club/location
  - field
  - source

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
