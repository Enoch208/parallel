export interface DiffableSession {
  readonly externalKey: string;
  readonly title: string;
  readonly room: string | null;
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface SessionChange {
  readonly externalKey: string;
  readonly title: string;
  readonly kind: "moved" | "room_changed" | "cancelled" | "added";
  readonly detail: string;
  readonly previousStartsAt: number | null;
  readonly nextStartsAt: number | null;
}

export interface AgendaDiff {
  readonly changes: readonly SessionChange[];
  readonly unchanged: number;
}

export const materialMoveMs = 5 * 60 * 1000;

export function normalizeKey(session: DiffableSession): string {
  return session.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function byKey(sessions: readonly DiffableSession[]): Map<string, DiffableSession> {
  return new Map(sessions.map((session) => [normalizeKey(session), session]));
}

function sameRoom(left: string | null, right: string | null): boolean {
  const clean = (value: string | null): string =>
    value === null ? "" : value.toLowerCase().replace(/\s+/g, " ").trim();

  return clean(left) === clean(right);
}

export function diffAgenda(
  previous: readonly DiffableSession[],
  next: readonly DiffableSession[],
): AgendaDiff {
  const before = byKey(previous);
  const after = byKey(next);
  const changes: SessionChange[] = [];
  let unchanged = 0;

  for (const [key, was] of before) {
    const now = after.get(key);

    if (now === undefined) {
      changes.push({
        externalKey: was.externalKey,
        title: was.title,
        kind: "cancelled",
        detail: "No longer on the published agenda",
        previousStartsAt: was.startsAt,
        nextStartsAt: null,
      });
      continue;
    }

    if (Math.abs(was.startsAt - now.startsAt) >= materialMoveMs) {
      changes.push({
        externalKey: now.externalKey,
        title: now.title,
        kind: "moved",
        detail: "The published time changed",
        previousStartsAt: was.startsAt,
        nextStartsAt: now.startsAt,
      });
      continue;
    }

    if (!sameRoom(was.room, now.room)) {
      changes.push({
        externalKey: now.externalKey,
        title: now.title,
        kind: "room_changed",
        detail:
          now.room === null
            ? "The published room was removed"
            : `The published room changed to ${now.room}`,
        previousStartsAt: was.startsAt,
        nextStartsAt: now.startsAt,
      });
      continue;
    }

    unchanged += 1;
  }

  for (const [key, now] of after) {
    if (!before.has(key)) {
      changes.push({
        externalKey: now.externalKey,
        title: now.title,
        kind: "added",
        detail: "New on the published agenda",
        previousStartsAt: null,
        nextStartsAt: now.startsAt,
      });
    }
  }

  return { changes, unchanged };
}

export function movedOrCancelled(diff: AgendaDiff): readonly SessionChange[] {
  return diff.changes.filter((change) => change.kind === "moved" || change.kind === "cancelled");
}
