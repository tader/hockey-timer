# Shared Event Schema

Contains canonical match event and projection types.

Entry point:
- `shared/event-schema/src/index.ts`

Includes:
- Event envelopes with UUID `eventId`.
- Event sort ordering (`occurredAt`, then `originDeviceId + sequence`).
- Minimal validation helpers.
