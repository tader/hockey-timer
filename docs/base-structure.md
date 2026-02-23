# Base Project Structure

```text
.
├─ AGENTS.md
├─ README.md
├─ docs/
├─ apps/
│  ├─ apple/
│  │  └─ HockeyTimer/
│  │     ├─ HockeyTimerIOS.xcodeproj
│  │     ├─ HockeyTimerIOS/
│  │     ├─ HockeyTimerWatch Watch App/
│  │     └─ HockeyTimerShared/
│  ├─ android/
│  │  ├─ phone/
│  │  └─ wearos/
│  └─ web/
├─ backend/
│  ├─ services/
│  └─ infrastructure/
└─ shared/
   ├─ event-schema/
   └─ replay-engine/
```

## Intent Per Area
- `apps/apple/HockeyTimer`: unified Apple project containing iOS + watch targets.
- `apps/apple/HockeyTimer/HockeyTimerShared`: shared Apple app code (models + API interaction).
- `apps/android/phone`: Android companion and match control.
- `apps/android/wearos`: Wear OS timer controls.
- `apps/web`: browser-based setup, monitoring, and operations.
- `backend/services`: Lambda/API domain services.
- `backend/infrastructure`: IaC and deployment configuration.
- `shared/event-schema`: canonical event definitions/contracts.
- `shared/replay-engine`: reference replay/projection implementation.

## Rule
Keep this structure implementation-ready, but do not start building features until planning decisions in `docs/decision-log.md` are resolved for MVP.
