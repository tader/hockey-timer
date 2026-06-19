import { type MatchEvent } from "@hockey-timer/event-schema";

const eventsByMatch = new Map<string, MatchEvent[]>();
const seenEventIds = new Set<string>();

export function upsertEvents(events: MatchEvent[]): { inserted: number; duplicates: number } {
  let inserted = 0;
  let duplicates = 0;

  for (const event of events) {
    if (seenEventIds.has(event.eventId)) {
      duplicates += 1;
      continue;
    }

    seenEventIds.add(event.eventId);
    const current = eventsByMatch.get(event.matchId) ?? [];
    current.push(event);
    eventsByMatch.set(event.matchId, current);
    inserted += 1;
  }

  return { inserted, duplicates };
}

export function getEvents(matchId: string): MatchEvent[] {
  return eventsByMatch.get(matchId) ?? [];
}

export function listEvents(): MatchEvent[] {
  return Array.from(eventsByMatch.values()).flat();
}

// Test hook for deterministic unit tests.
export function __resetStoreForTests(): void {
  eventsByMatch.clear();
  seenEventIds.clear();
}
