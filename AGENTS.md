# AGENTS.md

## Purpose
This repository is in documentation-first mode. Do not start implementation work until the sync and product design plan is approved.

## Product Scope
Build a native multi-platform Field Hockey Timer ecosystem:
- Apple Watch app (highest priority)
- iPhone/iPad companion app
- Web app (serverless cloud backend)
- Android phone app
- Android watch app

## Core Product Principles
- Event-sourced match model: all match state is derived from ordered events.
- Offline-first behavior: unreliable network must be expected, especially on watches.
- Eventual consistency across devices: sync should converge to the same match state.
- Platform-native UX on each client.

## Technology Direction
- Apple apps: SwiftUI (watchOS, iOS, iPadOS).
- Android apps: Kotlin + Jetpack Compose (phone + Wear OS).
- Web app: frontend + AWS serverless backend (Lambda, API Gateway, DynamoDB).
- Shared backend APIs for event ingestion, replication, and match retrieval.

## Documentation Rules
- `README.md` provides repo overview and navigation.
- All detailed product/technical docs live under `docs/`.
- Keep requirements and architecture decisions updated before implementation.
- Track unresolved decisions in `docs/decision-log.md`.
- Keep delivery work tracked in `docs/tasks.md`.

## Current Phase
Planning and architecture only:
1. Finalize event schema and replay model.
2. Finalize sync/conflict strategy for low-connectivity watches.
3. Finalize backend/serverless architecture.
4. Finalize platform app boundaries and milestones.

