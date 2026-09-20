import { readsAsTheSameTitle } from "./titleSimilarity";
export interface DiffableSession {
  readonly externalKey: string;
  readonly title: string;
  readonly room: string | null;
  readonly startsAt: number;
  readonly endsAt: number;
}

export type SessionChangeKind =
  "moved" | "room_changed" | "renamed" | "cancelled" | "added" | "ambiguous";

export interface SessionChange {
  readonly externalKey: string;
  readonly nextExternalKey: string | null;
  readonly title: string;
  readonly kind: SessionChangeKind;
  readonly detail: string;
  readonly previousStartsAt: number | null;
  readonly nextStartsAt: number | null;
}

export interface AgendaDiff {
  readonly changes: readonly SessionChange[];
  readonly unchanged: number;
}

interface Pairing {
  readonly previous: DiffableSession;
  readonly next: DiffableSession;
}

type Fit = (previous: DiffableSession, next: DiffableSession) => boolean;

export const materialMoveMs = 5 * 60 * 1000;

export function normalizeKey(session: DiffableSession): string {
  return session.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function roomKey(session: DiffableSession): string {
  return session.room === null ? "" : session.room.toLowerCase().replace(/\s+/g, " ").trim();
}

function sameTitle(left: DiffableSession, right: DiffableSession): boolean {
  return normalizeKey(left) === normalizeKey(right);
}

function sameRoom(left: DiffableSession, right: DiffableSession): boolean {
  return roomKey(left) === roomKey(right);
}

function sameSlot(left: DiffableSession, right: DiffableSession): boolean {
  return Math.abs(left.startsAt - right.startsAt) < materialMoveMs;
}

const stages: readonly Fit[] = [
  (previous, next) => previous.externalKey === next.externalKey,
  (previous, next) =>
    sameTitle(previous, next) && sameRoom(previous, next) && sameSlot(previous, next),
  (previous, next) => sameTitle(previous, next) && sameRoom(previous, next),
  (previous, next) => sameTitle(previous, next),
  (previous, next) =>
    sameRoom(previous, next) &&
    sameSlot(previous, next) &&
    readsAsTheSameTitle(normalizeKey(previous), normalizeKey(next)),
];

function couldBeTheSame(previous: DiffableSession, next: DiffableSession): boolean {
  return stages.some((fits) => fits(previous, next));
}

function unambiguousPairs(
  previous: readonly DiffableSession[],
  next: readonly DiffableSession[],
  fits: Fit,
): readonly Pairing[] {
  const pairs: Pairing[] = [];

  for (const was of previous) {
    const only = next.find((candidate) => fits(was, candidate));

    if (only === undefined) {
      continue;
    }

    const candidates = next.filter((candidate) => fits(was, candidate)).length;
    const rivals = previous.filter((candidate) => fits(candidate, only)).length;

    if (candidates !== 1 || rivals !== 1) {
      continue;
    }

    pairs.push({ previous: was, next: only });
  }

  return pairs;
}

interface Matching {
  readonly pairs: readonly Pairing[];
  readonly unmatchedPrevious: readonly DiffableSession[];
  readonly unmatchedNext: readonly DiffableSession[];
}

function pairSessions(
  previous: readonly DiffableSession[],
  next: readonly DiffableSession[],
): Matching {
  const pairs: Pairing[] = [];
  let openPrevious = [...previous];
  let openNext = [...next];

  for (const fits of stages) {
    const matched = unambiguousPairs(openPrevious, openNext, fits);

    if (matched.length === 0) {
      continue;
    }

    const takenPrevious = new Set(matched.map((pair) => pair.previous));
    const takenNext = new Set(matched.map((pair) => pair.next));

    pairs.push(...matched);
    openPrevious = openPrevious.filter((session) => !takenPrevious.has(session));
    openNext = openNext.filter((session) => !takenNext.has(session));
  }

  return { pairs, unmatchedPrevious: openPrevious, unmatchedNext: openNext };
}

function describeUnmatched(
  session: DiffableSession,
  rivals: number,
  side: "previous" | "next",
): SessionChange {
  const dropped = side === "previous";
  const shared = {
    externalKey: session.externalKey,
    nextExternalKey: dropped ? null : session.externalKey,
    title: session.title,
    previousStartsAt: dropped ? session.startsAt : null,
    nextStartsAt: dropped ? null : session.startsAt,
  };

  if (rivals === 0) {
    return dropped
      ? { ...shared, kind: "cancelled", detail: "No longer on the published agenda" }
      : { ...shared, kind: "added", detail: "New on the published agenda" };
  }

  const rival = `${String(rivals)} session${rivals === 1 ? "" : "s"}`;
  const other = dropped ? "new" : "previous";

  return {
    ...shared,
    kind: "ambiguous",
    detail: `${rival} on the ${other} agenda could be this one, so it was not matched automatically`,
  };
}

function describePair(pair: Pairing): SessionChange | null {
  const { previous, next } = pair;
  const shared = {
    externalKey: previous.externalKey,
    nextExternalKey: next.externalKey,
    previousStartsAt: previous.startsAt,
    nextStartsAt: next.startsAt,
  };

  if (!sameTitle(previous, next)) {
    return {
      ...shared,
      title: next.title,
      kind: "renamed",
      detail: `Retitled on the published agenda, from ${previous.title}`,
    };
  }

  if (!sameSlot(previous, next)) {
    return {
      ...shared,
      title: next.title,
      kind: "moved",
      detail: sameRoom(previous, next)
        ? "The published time changed"
        : `The published time changed, and the room is now ${next.room ?? "unlisted"}`,
    };
  }

  if (!sameRoom(previous, next)) {
    return {
      ...shared,
      title: next.title,
      kind: "room_changed",
      detail:
        next.room === null
          ? "The published room was removed"
          : `The published room changed to ${next.room}`,
    };
  }

  return null;
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function byReadingOrder(left: SessionChange, right: SessionChange): number {
  const leftStart = left.previousStartsAt ?? left.nextStartsAt ?? 0;
  const rightStart = right.previousStartsAt ?? right.nextStartsAt ?? 0;

  return (
    leftStart - rightStart ||
    Number(left.previousStartsAt === null) - Number(right.previousStartsAt === null) ||
    compareText(left.title, right.title) ||
    compareText(left.kind, right.kind) ||
    compareText(left.externalKey, right.externalKey)
  );
}

export function diffAgenda(
  previous: readonly DiffableSession[],
  next: readonly DiffableSession[],
): AgendaDiff {
  const { pairs, unmatchedPrevious, unmatchedNext } = pairSessions(previous, next);
  const changes: SessionChange[] = [];
  let unchanged = 0;

  for (const pair of pairs) {
    const change = describePair(pair);

    if (change === null) {
      unchanged += 1;
      continue;
    }

    changes.push(change);
  }

  for (const was of unmatchedPrevious) {
    const rivals = unmatchedNext.filter((candidate) => couldBeTheSame(was, candidate));

    changes.push(describeUnmatched(was, rivals.length, "previous"));
  }

  for (const now of unmatchedNext) {
    const rivals = unmatchedPrevious.filter((candidate) => couldBeTheSame(candidate, now));

    changes.push(describeUnmatched(now, rivals.length, "next"));
  }

  return { changes: [...changes].sort(byReadingOrder), unchanged };
}

export function movedOrCancelled(diff: AgendaDiff): readonly SessionChange[] {
  return diff.changes.filter(
    (change) =>
      change.kind === "moved" || change.kind === "cancelled" || change.kind === "ambiguous",
  );
}
