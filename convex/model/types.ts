export const sessionConfidence = ["high", "low"] as const;
export type SessionConfidence = (typeof sessionConfidence)[number];

export const planStatus = ["draft", "published", "stale", "infeasible"] as const;
export type PlanStatus = (typeof planStatus)[number];

export const activityKind = [
  "agenda_imported",
  "sessions_scored",
  "plan_optimized",
  "plan_repaired",
  "assignment_claimed",
  "assignment_released",
] as const;
export type ActivityKind = (typeof activityKind)[number];

export const sponsor = ["firecrawl", "openai", "agentmail", "convex"] as const;
export type Sponsor = (typeof sponsor)[number];

export interface TimeWindow {
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface SessionSummary extends TimeWindow {
  readonly id: string;
  readonly title: string;
  readonly track: string | null;
  readonly room: string | null;
  readonly speakers: readonly string[];
  readonly sourceUrl: string;
  readonly titleConfidence: SessionConfidence;
  readonly timeConfidence: SessionConfidence;
  readonly roomConfidence: SessionConfidence;
}

export interface GoalSummary {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
}

export interface RelevanceScore {
  readonly sessionId: string;
  readonly goalId: string;
  readonly relevance: number;
  readonly reason: string;
  readonly model: string;
}

export interface AssignmentSummary {
  readonly sessionId: string;
  readonly membershipId: string;
  readonly pinned: boolean;
  readonly reason: string;
}

export interface GoalCoverage {
  readonly goalId: string;
  readonly label: string;
  readonly weight: number;
  readonly coverage: number;
}

export interface CoverageSummary {
  readonly teamGoalCoverage: number;
  readonly perGoal: readonly GoalCoverage[];
  readonly uniqueSessions: number;
  readonly maxAttendableSessions: number;
  readonly duplicateAttendances: number;
}
