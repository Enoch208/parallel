import type { SessionSummary, TimeWindow } from "../model/types";

export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function compareSessions(a: SessionSummary, b: SessionSummary): number {
  if (a.startsAt !== b.startsAt) return a.startsAt - b.startsAt;
  if (a.endsAt !== b.endsAt) return a.endsAt - b.endsAt;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function sortedSessions(sessions: readonly SessionSummary[]): SessionSummary[] {
  return [...sessions].sort(compareSessions);
}

export function groupSessionIndicesByWindow(sessions: readonly SessionSummary[]): number[][] {
  const indicesByStart = new Map<number, number[]>();
  sessions.forEach((session, index) => {
    const existing = indicesByStart.get(session.startsAt);
    if (existing === undefined) {
      indicesByStart.set(session.startsAt, [index]);
      return;
    }
    existing.push(index);
  });
  return [...indicesByStart.entries()]
    .sort((left, right) => left[0] - right[0])
    .map((entry) => entry[1]);
}

export function windowIndexBySessionIndex(
  windows: readonly (readonly number[])[],
): Map<number, number> {
  const lookup = new Map<number, number>();
  windows.forEach((sessionIndices, windowIndex) => {
    for (const sessionIndex of sessionIndices) lookup.set(sessionIndex, windowIndex);
  });
  return lookup;
}
