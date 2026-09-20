import type {
  AssignmentSummary,
  CoverageSummary,
  GoalSummary,
  RelevanceScore,
  SessionSummary,
  TimeWindow,
} from "../model/types";

export const memberStance = ["interested", "avoid", "pinned"] as const;
export type MemberStance = (typeof memberStance)[number];

export interface MemberSummary {
  readonly id: string;
  readonly displayName: string;
}

export interface AvailabilityBlockSummary extends TimeWindow {
  readonly membershipId: string;
  readonly reason: string;
}

export interface MemberPreferenceSummary {
  readonly membershipId: string;
  readonly sessionId: string;
  readonly stance: MemberStance;
}

export interface CoverageInput {
  readonly sessions: readonly SessionSummary[];
  readonly goals: readonly GoalSummary[];
  readonly scores: readonly RelevanceScore[];
  readonly members: readonly MemberSummary[];
}

export interface OptimizerInput extends CoverageInput {
  readonly preferences: readonly MemberPreferenceSummary[];
  readonly blocks: readonly AvailabilityBlockSummary[];
}

export interface ObjectiveBreakdown {
  readonly teamGoalCoverage: number;
  readonly interestBonus: number;
  readonly duplicatePenalty: number;
  readonly changePenalty: number;
  readonly objective: number;
}

export const pinConflictKind = [
  "unknown_member",
  "unknown_session",
  "blocked_time",
  "pin_overlap",
] as const;
export type PinConflictKind = (typeof pinConflictKind)[number];

export interface PinConflict {
  readonly kind: PinConflictKind;
  readonly membershipId: string;
  readonly sessionIds: readonly string[];
  readonly detail: string;
}

export interface PlanOutcome {
  readonly kind: "plan";
  readonly assignments: readonly AssignmentSummary[];
  readonly coverage: CoverageSummary;
  readonly objective: ObjectiveBreakdown;
}

export interface InfeasibleOutcome {
  readonly kind: "infeasible";
  readonly blockingPinnedSessionIds: readonly string[];
  readonly conflicts: readonly PinConflict[];
}

export type OptimizeOutcome = PlanOutcome | InfeasibleOutcome;
