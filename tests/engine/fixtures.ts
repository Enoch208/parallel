import type { GoalSummary, RelevanceScore, SessionSummary } from "../../convex/model/types";
import type {
  AvailabilityBlockSummary,
  MemberPreferenceSummary,
  MemberStance,
  MemberSummary,
} from "../../convex/engine/types";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY_START = Date.UTC(2026, 8, 22, 16, 0, 0);

export function at(hoursFromStart: number): number {
  return DAY_START + hoursFromStart * HOUR;
}

export function session(
  id: string,
  title: string,
  startHour: number,
  durationHours: number,
  track: string,
): SessionSummary {
  return {
    id,
    title,
    track,
    room: `Room ${track}`,
    speakers: [],
    sourceUrl: "https://example.test/agenda",
    startsAt: at(startHour),
    endsAt: at(startHour + durationHours),
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
  };
}

export function goal(id: string, label: string, weight: number): GoalSummary {
  return { id, label, weight };
}

export function member(id: string, displayName: string): MemberSummary {
  return { id, displayName };
}

export function score(sessionId: string, goalId: string, relevance: number): RelevanceScore {
  return {
    sessionId,
    goalId,
    relevance,
    reason: `${sessionId} advances ${goalId}`,
    model: "fixture",
  };
}

export function scoreRow(
  sessionId: string,
  goalIds: readonly string[],
  relevances: readonly number[],
): RelevanceScore[] {
  return goalIds.map((goalId, index) => score(sessionId, goalId, relevances[index] ?? 0));
}

export function preference(
  membershipId: string,
  sessionId: string,
  stance: MemberStance,
): MemberPreferenceSummary {
  return { membershipId, sessionId, stance };
}

export function block(
  membershipId: string,
  startHour: number,
  durationHours: number,
  reason: string,
): AvailabilityBlockSummary {
  return {
    membershipId,
    startsAt: at(startHour),
    endsAt: at(startHour + durationHours),
    reason,
  };
}
