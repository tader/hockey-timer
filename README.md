# Hockey Timer Ecosystem

Documentation-first repository for a multi-platform Field Hockey Timer ecosystem.

## Goals
- Build native apps for:
  - Apple Watch (most important)
  - iPhone/iPad companion
  - Web
  - Android phone
  - Android watch
- Keep match state in sync across devices/web under poor connectivity.
- Use event-based match state so replaying events reconstructs score/time.
- Support customizable match formats, including in-progress format changes.
- Allow anonymous-first usage, with optional later sign-in and data merge.
- Support multi-user match collaboration with role-based permissions.
- Integrate with KNHB Match Center data.

## Current Status
MVP execution in progress with Apple + web focus; Android is temporarily paused.
Delivery policy: implement new user features in web first, then iOS/watch with parity.

## Documentation Map
- `docs/product-requirements.md`:
  Full requirement capture from stakeholder wishes.
- `docs/base-structure.md`:
  Repository layout and ownership intent by area.
- `docs/event-model.md`:
  Event-sourcing model, event types, replay rules, and invariants.
- `docs/sync-and-consistency-plan.md`:
  Offline-first sync strategy for phones/watches/web and conflict handling.
- `docs/architecture-overview.md`:
  Proposed platform and AWS serverless architecture baseline.
- `docs/knhb-integration.md`:
  KNHB Match Center integration assumptions and approach.
- `docs/tasks.md`:
  Phased task list (planning first, implementation later).
- `docs/implementation-status.md`:
  Current implementation progress and near-term priorities.
- `docs/decision-log.md`:
  Open decisions and ADR-style tracking.
- `docs/watch-wireframes.md`:
  Apple Watch screen wireframes and interaction concepts for fast in-match usage.

## Immediate Next Step
Implement end-to-end event flow for one demo match:
watch action -> event ingestion API -> projection poll -> watch/iOS/web refresh.

## MVP Scaffold Implemented
- Shared TypeScript event schema with UUID validation and deterministic ordering:
  - `shared/event-schema/src/index.ts`
- Shared replay/projection engine:
  - `shared/replay-engine/src/index.ts`
- Backend service handlers (batch upsert, list events, projection):
  - `backend/services/events/src/handlers.ts`
- AWS infra template baseline:
  - `backend/infrastructure/template.yaml`
- Web MVP reference implementation (match list/manage/import/live controls):
  - `apps/web/index.html`
  - `apps/web/src/main.ts`
- Unified Apple Xcode project (iOS + watch):
  - `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS.xcodeproj`
- Shared Apple match sync code (used by iOS + watch):
  - `apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerShared/MatchSyncViewModel.swift`
- Apple runtime improvements implemented:
  - Configurable API base setting (iOS + watch).
  - Durable offline event queue with retry on reconnect.
  - iOS KNHB import flow (club -> team -> upcoming match).
  - iOS custom match creation + metadata editing.
  - iOS match list filters (home/away/club/team) + newest-first sorting.
  - KNHB metadata includes `homeTeam`, `awayTeam`, and `knhbMatchId`.

## Validation
- Typecheck passes for all TypeScript workspaces:
  - `npm run check`
- Unit tests across workspaces:
  - `npm run test`

## Local Demo Run
1. Start backend events service:
   - `npm run start:events`
2. Build web app:
   - `npm run build:web`
3. Serve web app:
   - `npm run -w @hockey-timer/web serve`
4. Open:
   - `http://localhost:4173`

## Production Compose Run
- Build and start API + web frontend:
  - `docker-compose -f compose.yaml up --build`
- Open:
  - `http://localhost:4173`
- API:
  - `http://localhost:8787`

## Apple Build Commands
- List available build recipes:
  - `just --list`
- Build iOS + watch for simulator:
  - `just build-all-sim`
- Build only iOS simulator:
  - `just build-ios-sim`
- Build only watch simulator:
  - `just build-watch-sim`
