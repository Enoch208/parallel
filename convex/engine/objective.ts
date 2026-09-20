import type { AssignmentSummary } from "../model/types";
import { DUPLICATE_ATTENDANCE_PENALTY, INTEREST_BONUS, REPAIR_CHANGE_PENALTY } from "./constants";
import type { EngineContext } from "./context";
import { buildEngineContext } from "./context";
import { coverageSummaryFromContext } from "./coverage";
import { itemAt, valueFor } from "./lookup";
import type { ObjectiveBreakdown, OptimizerInput } from "./types";

export function interestHitCount(
  context: EngineContext,
  interested: readonly (readonly boolean[])[],
  assignments: readonly AssignmentSummary[],
): number {
  const seen = new Set<string>();
  let hits = 0;
  for (const assignment of assignments) {
    const key = `${assignment.membershipId}\u0000${assignment.sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const memberIndex = valueFor(context.memberIndexById, assignment.membershipId, "membership");
    const sessionIndex = valueFor(context.sessionIndexById, assignment.sessionId, "session");
    if (itemAt(itemAt(interested, memberIndex), sessionIndex)) hits += 1;
  }
  return hits;
}

export function breakdownFrom(
  teamGoalCoverage: number,
  interestHits: number,
  duplicateAttendances: number,
  changedAssignments: number,
): ObjectiveBreakdown {
  const interestBonus = INTEREST_BONUS * interestHits;
  const duplicatePenalty = DUPLICATE_ATTENDANCE_PENALTY * duplicateAttendances;
  const changePenalty = REPAIR_CHANGE_PENALTY * changedAssignments;
  return {
    teamGoalCoverage,
    interestBonus,
    duplicatePenalty,
    changePenalty,
    objective: teamGoalCoverage + interestBonus - duplicatePenalty - changePenalty,
  };
}

function interestedMatrix(context: EngineContext, input: OptimizerInput): boolean[][] {
  const matrix = context.members.map(() => new Array<boolean>(context.sessions.length).fill(false));
  for (const preference of input.preferences) {
    if (preference.stance !== "interested") continue;
    const memberIndex = context.memberIndexById.get(preference.membershipId);
    const sessionIndex = context.sessionIndexById.get(preference.sessionId);
    if (memberIndex === undefined || sessionIndex === undefined) continue;
    itemAt(matrix, memberIndex)[sessionIndex] = true;
  }
  return matrix;
}

export function scoreAssignments(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
): ObjectiveBreakdown {
  const context = buildEngineContext(input);
  const coverage = coverageSummaryFromContext(context, assignments);
  const hits = interestHitCount(context, interestedMatrix(context, input), assignments);
  return breakdownFrom(coverage.teamGoalCoverage, hits, coverage.duplicateAttendances, 0);
}
