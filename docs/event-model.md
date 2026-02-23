# Event Model (Draft)

## Why Event-Sourced
Connectivity will be unreliable. An append-only event log allows:
- Local-first writes on every device.
- Replay to recover state and audit corrections.
- Deterministic convergence when events are merged and ordered.

## Core Entities
- `Match`
- `MatchFormat` (period count + period durations)
- `Event`
- `DeviceReplica` (origin metadata for conflict resolution and sync)

## Event Envelope (Proposed)
- `eventId` (UUID)
- `matchId`
- `eventType`
- `occurredAt` (device timestamp)
- `recordedAt` (server timestamp, optional until synced)
- `originDeviceId`
- `originPlatform` (watchOS/iOS/web/android/wear)
- `sequence` (per-device monotonic counter)
- `payload` (event-specific data)
- `version` (schema version)

## Candidate Event Types
- `match.created`
- `match.started`
- `match.paused`
- `match.resumed`
- `period.started`
- `period.ended`
- `score.changed`:
  payload: `{ team: home|away, delta: +1|-1|... , reason: goal|correction|manual }`
- `match.format.updated`:
  payload: `{ periodCount, periodDurationSeconds[] }`
- `match.ended`
- `match.note.added` (optional future)

## Replay Rules (High-Level)
- Canonical event order uses trusted device `occurredAt`.
- Ties are resolved by deterministic `originDeviceId + sequence`.
- Match score = sum of all `score.changed` deltas by team.
- Match format is latest valid `match.format.updated` (or initial default),
  and applies immediately including the active current period.
- Played time is derived from start/resume/pause/period boundary event windows.
- Invalid transitions are rejected at write-time when possible and flagged at replay-time when not.

## Invariants
- Events are immutable.
- `eventId` is a globally unique UUID.
- Duplicate event ingestion is idempotent.
- State is a pure function of ordered events.

## Open Design Questions
- Should `period.started` be explicit or inferred?
- How strict should validation be in offline mode?
