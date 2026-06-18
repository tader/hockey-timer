# Sync and Consistency Plan (Draft)

## Problem Context
- Watches (Apple Watch, Wear OS) may have intermittent or no network.
- Devices can generate concurrent edits (e.g., score correction on phone while watch is offline).
- Users need fast local interaction and trustworthy eventual convergence.

## Sync Objectives
- Local write latency near-zero (offline-first).
- No event loss.
- Duplicate-safe ingestion.
- Convergent state across watch/phone/web/backend.
- Conflict behavior that is deterministic and explainable.
- Support anonymous-first local identities and later managed-account merge
  without data loss.

## Proposed Strategy

## 1) Client-Side
- Maintain local append-only event log per match.
- Every new event gets `(eventId UUID, originDeviceId, sequence)`.
- Apply locally immediately (optimistic local truth).
- On Apple Watch, local projection is authoritative for live operation. Starting
  a new match, score updates, and clock state must work even with no phone or
  internet path. Network fetches may repair or converge later, but must not
  block the watch UI.
- Sync worker retries with exponential backoff and jitter.
- Persist outbound queue durably.
- Use gossip-style peer exchange: replicas share known/missing events and converge.

## 2) Server-Side
- API accepts idempotent batched event upserts.
- API requires authenticated bearer tokens for hosted sync calls.
- Deduplicate by `eventId` UUID.
- Persist raw event stream in DynamoDB.
- Publish accepted events to polling endpoints (MVP transport).
- Return high-water mark / checkpoint per match stream.
- Enforce role-based write authorization (`RW` required for mutating events).

## 3) Merge & Ordering
- Primary deterministic sort proposal:
  1. `occurredAt` (trusted device time)
  2. tie-break by `originDeviceId + sequence`
- Keep original envelope fields for audit.
- Mark anomalies (e.g., impossible state transition) for UI visibility.

## 4) Connectivity Paths
- Watch ↔ Phone local sync is preferred (Bluetooth/Wi-Fi local transport).
- Phone ↔ Cloud/Web sync is next preferred path.
- If watch cannot sync with phone, watch syncs directly with cloud/web when reachable.
- If no path is available, device keeps events locally and retries later.

## 4.1) Identity and Membership Sync
- Devices start with local anonymous identity if user is not signed in.
- Native apps can keep working locally without API configuration or sign-in.
- Web app and hosted API sync require managed federated sign-in.
- On sign-in, run identity merge: attach anonymous-created events/matches to the
  managed account identity while keeping immutable original event metadata.
- Apple Watch does not perform provider sign-in. iPhone owns sign-in and mirrors
  authenticated sync state to the paired watch; if that state is absent, watch
  queues events locally.
- Sync membership/roles alongside events to keep authorization decisions consistent.
- Join discovery supports location-assisted candidate listing when user grants permission.
- Public sessions can be joined as `RO` without sign-in.

## 5) Conflict Handling
- Score changes are additive deltas; corrections are explicit deltas.
- Format updates use last-writer-wins by canonical order.
- Start/pause/resume conflicts:
  - preserve all events
  - replay engine resolves final active/paused state deterministically
  - no advanced MVP conflict workflow; corrections are manual events

## 6) Operational Safety
- Full event history retained for audit/rebuild.
- Hybrid projections:
  - synchronous lightweight projection update at write-time for fast reads
  - asynchronous rebuild/repair from event store for drift recovery

## Open Decisions Before Build
- None. MVP planning decisions are sufficiently defined.
