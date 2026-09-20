import { REPAIR_CHANGE_PENALTY } from "../../convex/engine/constants";
import { overlaps, sortedSessions } from "../../convex/engine/intervals";
import { scoreAssignments } from "../../convex/engine/objective";
import { countMovedAssignments } from "../../convex/engine/planDiff";
import type { MemberStance, OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";

function windowsOf(sessions: readonly SessionSummary[]): SessionSummary[][] {
  const byStart = new Map<number, SessionSummary[]>();
  for (const entry of sortedSessions(sessions)) {
    const existing = byStart.get(entry.startsAt);
    if (existing === undefined) byStart.set(entry.startsAt, [entry]);
    else existing.push(entry);
  }
  return [...byStart.entries()].sort((left, right) => left[0] - right[0]).map((entry) => entry[1]);
}

function stanceFor(
  input: OptimizerInput,
  membershipId: string,
  sessionId: string,
): MemberStance | undefined {
  return input.preferences.find(
    (entry) => entry.membershipId === membershipId && entry.sessionId === sessionId,
  )?.stance;
}

function allowedForMember(
  input: OptimizerInput,
  membershipId: string,
  entry: SessionSummary,
): boolean {
  const stance = stanceFor(input, membershipId, entry.id);
  if (stance === "pinned") return true;
  if (stance === "avoid") return false;
  return !input.blocks.some(
    (unavailable) => unavailable.membershipId === membershipId && overlaps(unavailable, entry),
  );
}

function pinnedSessionIds(input: OptimizerInput, membershipId: string): string[] {
  return input.preferences
    .filter((entry) => entry.membershipId === membershipId && entry.stance === "pinned")
    .map((entry) => entry.sessionId);
}

export function feasibleSchedules(input: OptimizerInput, membershipId: string): SessionSummary[][] {
  const pins = pinnedSessionIds(input, membershipId);
  let schedules: SessionSummary[][] = [[]];
  for (const windowSessions of windowsOf(input.sessions)) {
    const next: SessionSummary[][] = [];
    for (const schedule of schedules) {
      next.push(schedule);
      for (const entry of windowSessions) {
        if (!allowedForMember(input, membershipId, entry)) continue;
        if (schedule.some((taken) => overlaps(taken, entry))) continue;
        next.push([...schedule, entry]);
      }
    }
    schedules = next;
  }
  return schedules.filter((schedule) =>
    pins.every((pinned) => schedule.some((entry) => entry.id === pinned)),
  );
}

function penalizedScore(
  input: OptimizerInput,
  current: readonly AssignmentSummary[] | null,
  assignments: readonly AssignmentSummary[],
): number {
  const base = scoreAssignments(input, assignments).objective;
  if (current === null) return base;
  return base - REPAIR_CHANGE_PENALTY * countMovedAssignments(input.sessions, current, assignments);
}

export function bruteForceOptimum(
  input: OptimizerInput,
  current: readonly AssignmentSummary[] | null = null,
): number {
  const perMember = input.members.map((teammate) => ({
    membershipId: teammate.id,
    schedules: feasibleSchedules(input, teammate.id),
  }));
  let best = Number.NEGATIVE_INFINITY;
  const walk = (index: number, assignments: readonly AssignmentSummary[]): void => {
    const entry = perMember[index];
    if (entry === undefined) {
      best = Math.max(best, penalizedScore(input, current, assignments));
      return;
    }
    for (const schedule of entry.schedules) {
      walk(index + 1, [
        ...assignments,
        ...schedule.map((chosen) => ({
          sessionId: chosen.id,
          membershipId: entry.membershipId,
          pinned: false,
          reason: "brute force",
        })),
      ]);
    }
  };
  walk(0, []);
  return best;
}
