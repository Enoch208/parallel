import type { AssignmentSummary, SessionSummary } from "../model/types";
import {
  groupSessionIndicesByWindow,
  sortedSessions,
  windowIndexBySessionIndex,
} from "./intervals";
import { valueFor } from "./lookup";

function slotChoices(
  sessions: readonly SessionSummary[],
  assignments: readonly AssignmentSummary[],
): Map<string, string> {
  const ordered = sortedSessions(sessions);
  const indexById = new Map(ordered.map((session, index) => [session.id, index] as const));
  const windowOfSession = windowIndexBySessionIndex(groupSessionIndicesByWindow(ordered));
  const choices = new Map<string, string>();
  for (const assignment of assignments) {
    const sessionIndex = valueFor(indexById, assignment.sessionId, "session");
    const windowIndex = valueFor(windowOfSession, sessionIndex, "time window");
    choices.set(`${assignment.membershipId}\u0000${String(windowIndex)}`, assignment.sessionId);
  }
  return choices;
}

export function countMovedAssignments(
  sessions: readonly SessionSummary[],
  previous: readonly AssignmentSummary[],
  next: readonly AssignmentSummary[],
): number {
  const before = slotChoices(sessions, previous);
  const after = slotChoices(sessions, next);
  const slots = new Set([...before.keys(), ...after.keys()]);
  let moved = 0;
  for (const slot of slots) {
    if (before.get(slot) !== after.get(slot)) moved += 1;
  }
  return moved;
}
