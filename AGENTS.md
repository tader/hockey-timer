# AGENTS.md

## Purpose
Build and iterate the hockey timer ecosystem with Apple apps as the current active delivery focus.

## Product Scope
Build a native multi-platform Field Hockey Timer ecosystem:
- Apple Watch app (highest priority)
- iPhone/iPad companion app
- Web app (serverless cloud backend)
- Android phone app
- Android watch app
Note: Android implementation is currently paused until Apple apps are satisfactory.

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
Apple + web MVP implementation and hardening:
1. Implement new product features in web app first.
2. Port the same features to iOS and watch with parity before marking done.
3. Complete serverless-ready backend APIs and integration tests.
4. Keep Android work paused until Apple acceptance.

## Delivery Order Policy
- Web app is the reference implementation for new features.
- Every user-facing feature must ship in this order:
  1. Web
  2. iOS
  3. watchOS
- Feature work is only complete when web and Apple apps are on par.
