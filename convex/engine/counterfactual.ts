import type { AssignmentSummary, CoverageSummary, SessionSummary } from "../model/types";
import { buildEngineContext } from "./context";
import { computeCoverageSummary } from "./coverage";
import { overlaps } from "./intervals";
import { itemAt, valueFor } from "./lookup";
import { scoreAssignments } from "./objective";
import type { MemberStance, ObjectiveBreakdown, OptimizerInput } from "./types";

const COUNTERFACTUAL_REASON = "counterfactual";

export const exclusionKind = ["already_taken", "blocked", "overlap"] as const;
export type ExclusionKind = (typeof exclusionKind)[number];

export interface Exclusion {
  readonly kind: ExclusionKind;
  readonly conflictingSessionId: string | null;
  readonly conflictingSessionTitle: string | null;
  readonly blockReason: string | null;
}

export interface GoalDelta {
  readonly goalId: string;
  readonly label: string;
  readonly weight: number;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly weightedDelta: number;
}

export interface ScenarioDelta {
  readonly teamGoalCoverage: number;
  readonly interestBonus: number;
  readonly duplicatePenalty: number;
  readonly objective: number;
  readonly uniqueSessions: number;
  readonly duplicateAttendances: number;
  readonly perGoal: readonly GoalDelta[];
  readonly topGoal: GoalDelta | null;
}

export interface MarginalContribution {
  readonly membershipId: string;
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly pinned: boolean;
  readonly withAssignment: ObjectiveBreakdown;
  readonly withoutAssignment: ObjectiveBreakdown;
  readonly delta: ScenarioDelta;
}

export interface Alternative {
  readonly sessionId: string;
  readonly title: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly stance: MemberStance | null;
  readonly breakdown: ObjectiveBreakdown;
  readonly delta: ScenarioDelta;
}

export interface ExcludedAlternative {
  readonly sessionId: string;
  readonly title: string;
  readonly exclusion: Exclusion;
}

export interface AssignmentExplanation {
  readonly membershipId: string;
  readonly displayName: string;
  readonly windowStartsAt: number;
  readonly marginal: MarginalContribution;
  readonly alternatives: readonly Alternative[];
  readonly excluded: readonly ExcludedAlternative[];
}

export interface SessionCandidate {
  readonly membershipId: string;
  readonly displayName: string;
  readonly stance: MemberStance | null;
  readonly breakdown: ObjectiveBreakdown | null;
  readonly delta: ScenarioDelta | null;
  readonly exclusion: Exclusion | null;
}

export interface SessionExplanation {
  readonly sessionId: string;
  readonly title: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly planBreakdown: ObjectiveBreakdown;
  readonly attendeeMembershipIds: readonly string[];
  readonly candidates: readonly SessionCandidate[];
}

interface Scenario {
  readonly breakdown: ObjectiveBreakdown;
  readonly coverage: CoverageSummary;
}

function evaluate(input: OptimizerInput, assignments: readonly AssignmentSummary[]): Scenario {
  return {
    breakdown: scoreAssignments(input, assignments),
    coverage: computeCoverageSummary(input, assignments),
  };
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function goalDeltas(before: CoverageSummary, after: CoverageSummary): GoalDelta[] {
  const beforeByGoal = new Map(before.perGoal.map((entry) => [entry.goalId, entry.coverage]));
  return after.perGoal.map((entry) => {
    const start = valueFor(beforeByGoal, entry.goalId, "goal");
    const delta = entry.coverage - start;
    return {
      goalId: entry.goalId,
      label: entry.label,
      weight: entry.weight,
      before: start,
      after: entry.coverage,
      delta,
      weightedDelta: entry.weight * delta,
    };
  });
}

function strongestGoal(perGoal: readonly GoalDelta[]): GoalDelta | null {
  let best: GoalDelta | null = null;
  for (const entry of perGoal) {
    if (entry.weightedDelta === 0) continue;
    if (best === null || Math.abs(entry.weightedDelta) > Math.abs(best.weightedDelta)) best = entry;
  }
  return best;
}

function deltaBetween(before: Scenario, after: Scenario): ScenarioDelta {
  const perGoal = goalDeltas(before.coverage, after.coverage);
  return {
    teamGoalCoverage: after.breakdown.teamGoalCoverage - before.breakdown.teamGoalCoverage,
    interestBonus: after.breakdown.interestBonus - before.breakdown.interestBonus,
    duplicatePenalty: after.breakdown.duplicatePenalty - before.breakdown.duplicatePenalty,
    objective: after.breakdown.objective - before.breakdown.objective,
    uniqueSessions: after.coverage.uniqueSessions - before.coverage.uniqueSessions,
    duplicateAttendances:
      after.coverage.duplicateAttendances - before.coverage.duplicateAttendances,
    perGoal,
    topGoal: strongestGoal(perGoal),
  };
}

function stanceFor(
  input: OptimizerInput,
  membershipId: string,
  sessionId: string,
): MemberStance | null {
  for (const preference of input.preferences) {
    if (preference.membershipId === membershipId && preference.sessionId === sessionId) {
      return preference.stance;
    }
  }
  return null;
}

function exclusionFor(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
  sessionById: ReadonlyMap<string, SessionSummary>,
  membershipId: string,
  session: SessionSummary,
): Exclusion | null {
  const held = assignments.filter((entry) => entry.membershipId === membershipId);
  if (held.some((entry) => entry.sessionId === session.id)) {
    return {
      kind: "already_taken",
      conflictingSessionId: session.id,
      conflictingSessionTitle: session.title,
      blockReason: null,
    };
  }
  for (const window of input.blocks) {
    if (window.membershipId !== membershipId || !overlaps(window, session)) continue;
    return {
      kind: "blocked",
      conflictingSessionId: null,
      conflictingSessionTitle: null,
      blockReason: window.reason,
    };
  }
  for (const entry of held) {
    const other = sessionById.get(entry.sessionId);
    if (other === undefined || !overlaps(other, session)) continue;
    return {
      kind: "overlap",
      conflictingSessionId: other.id,
      conflictingSessionTitle: other.title,
      blockReason: null,
    };
  }
  return null;
}

function assignmentsWithout(
  assignments: readonly AssignmentSummary[],
  membershipId: string,
  sessionId: string,
): AssignmentSummary[] {
  return assignments.filter(
    (entry) => entry.membershipId !== membershipId || entry.sessionId !== sessionId,
  );
}

function assignmentsWith(
  assignments: readonly AssignmentSummary[],
  membershipId: string,
  sessionId: string,
): AssignmentSummary[] {
  return [
    ...assignments,
    { membershipId, sessionId, pinned: false, reason: COUNTERFACTUAL_REASON },
  ];
}

export function explainAssignment(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
  membershipId: string,
  sessionId: string,
): AssignmentExplanation {
  const context = buildEngineContext(input);
  const member = input.members.find((entry) => entry.id === membershipId);
  if (member === undefined) throw new RangeError(`Unknown membership: ${membershipId}`);
  const held = assignments.find(
    (entry) => entry.membershipId === membershipId && entry.sessionId === sessionId,
  );
  if (held === undefined) {
    throw new RangeError(`${membershipId} is not assigned to ${sessionId} in this plan`);
  }
  const sessionIndex = valueFor(context.sessionIndexById, sessionId, "session");
  const session = itemAt(context.sessions, sessionIndex);
  const sessionById = new Map(context.sessions.map((entry) => [entry.id, entry] as const));
  const actual = evaluate(input, assignments);
  const remaining = assignmentsWithout(assignments, membershipId, sessionId);
  const without = evaluate(input, remaining);
  const windowIndex = valueFor(context.windowOfSession, sessionIndex, "time window");
  const alternatives: Alternative[] = [];
  const excluded: ExcludedAlternative[] = [];
  for (const candidateIndex of itemAt(context.windows, windowIndex)) {
    if (candidateIndex === sessionIndex) continue;
    const candidate = itemAt(context.sessions, candidateIndex);
    const exclusion = exclusionFor(input, remaining, sessionById, membershipId, candidate);
    if (exclusion !== null) {
      excluded.push({ sessionId: candidate.id, title: candidate.title, exclusion });
      continue;
    }
    const swapped = evaluate(input, assignmentsWith(remaining, membershipId, candidate.id));
    alternatives.push({
      sessionId: candidate.id,
      title: candidate.title,
      startsAt: candidate.startsAt,
      endsAt: candidate.endsAt,
      stance: stanceFor(input, membershipId, candidate.id),
      breakdown: swapped.breakdown,
      delta: deltaBetween(actual, swapped),
    });
  }
  alternatives.sort(
    (left, right) =>
      right.delta.objective - left.delta.objective ||
      right.delta.teamGoalCoverage - left.delta.teamGoalCoverage ||
      compareStrings(left.sessionId, right.sessionId),
  );
  excluded.sort((left, right) => compareStrings(left.sessionId, right.sessionId));
  return {
    membershipId,
    displayName: member.displayName,
    windowStartsAt: session.startsAt,
    marginal: {
      membershipId,
      sessionId,
      sessionTitle: session.title,
      pinned: held.pinned,
      withAssignment: actual.breakdown,
      withoutAssignment: without.breakdown,
      delta: deltaBetween(without, actual),
    },
    alternatives,
    excluded,
  };
}

export function explainSession(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
  sessionId: string,
): SessionExplanation {
  const context = buildEngineContext(input);
  const sessionIndex = valueFor(context.sessionIndexById, sessionId, "session");
  const session = itemAt(context.sessions, sessionIndex);
  const sessionById = new Map(context.sessions.map((entry) => [entry.id, entry] as const));
  const actual = evaluate(input, assignments);
  const candidates: SessionCandidate[] = context.members.map((member) => {
    const exclusion = exclusionFor(input, assignments, sessionById, member.id, session);
    const stance = stanceFor(input, member.id, sessionId);
    if (exclusion !== null) {
      return {
        membershipId: member.id,
        displayName: member.displayName,
        stance,
        breakdown: null,
        delta: null,
        exclusion,
      };
    }
    const added = evaluate(input, assignmentsWith(assignments, member.id, sessionId));
    return {
      membershipId: member.id,
      displayName: member.displayName,
      stance,
      breakdown: added.breakdown,
      delta: deltaBetween(actual, added),
      exclusion: null,
    };
  });
  candidates.sort((left, right) => {
    if (left.delta === null || right.delta === null) {
      if (left.delta !== null) return -1;
      if (right.delta !== null) return 1;
      return compareStrings(left.membershipId, right.membershipId);
    }
    return (
      right.delta.teamGoalCoverage - left.delta.teamGoalCoverage ||
      right.delta.objective - left.delta.objective ||
      compareStrings(left.membershipId, right.membershipId)
    );
  });
  return {
    sessionId,
    title: session.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    planBreakdown: actual.breakdown,
    attendeeMembershipIds: assignments
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => entry.membershipId)
      .sort(compareStrings),
    candidates,
  };
}
