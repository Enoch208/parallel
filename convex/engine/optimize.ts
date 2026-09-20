import type { AssignmentSummary } from "../model/types";
import type { SearchState } from "./beam";
import { runBeamSearch } from "./beam";
import { coverageSummaryFromContext } from "./coverage";
import { blockingPinnedSessionIds, findPinConflicts } from "./feasibility";
import { itemAt, valueFor } from "./lookup";
import { breakdownFrom, interestHitCount } from "./objective";
import { describeAssignment } from "./reasons";
import type { SearchPlan } from "./searchPlan";
import { buildSearchPlan } from "./searchPlan";
import type { OptimizeOutcome, OptimizerInput } from "./types";

function buildAssignments(plan: SearchPlan, state: SearchState): AssignmentSummary[] {
  const assignments: AssignmentSummary[] = [];
  plan.context.members.forEach((member, memberIndex) => {
    for (const sessionIndex of itemAt(state.memberSessions, memberIndex)) {
      const windowIndex = valueFor(plan.context.windowOfSession, sessionIndex, "time window");
      const pinned = itemAt(itemAt(plan.forced, memberIndex), windowIndex) === sessionIndex;
      const interested = itemAt(itemAt(plan.interested, memberIndex), sessionIndex);
      assignments.push({
        sessionId: itemAt(plan.context.sessions, sessionIndex).id,
        membershipId: member.id,
        pinned,
        reason: describeAssignment(plan.context, sessionIndex, pinned, interested),
      });
    }
  });
  return assignments;
}

function runOptimizer(
  input: OptimizerInput,
  current: readonly AssignmentSummary[] | null,
): OptimizeOutcome {
  const conflicts = findPinConflicts(input);
  if (conflicts.length > 0) {
    return {
      kind: "infeasible",
      blockingPinnedSessionIds: blockingPinnedSessionIds(conflicts),
      conflicts,
    };
  }
  const plan = buildSearchPlan(input, current);
  const best = runBeamSearch(plan);
  const assignments = buildAssignments(plan, best);
  const coverage = coverageSummaryFromContext(plan.context, assignments);
  const hits = interestHitCount(plan.context, plan.interested, assignments);
  return {
    kind: "plan",
    assignments,
    coverage,
    objective: breakdownFrom(
      coverage.teamGoalCoverage,
      hits,
      coverage.duplicateAttendances,
      best.changes,
    ),
  };
}

export function optimizePlan(input: OptimizerInput): OptimizeOutcome {
  return runOptimizer(input, null);
}

export function repairPlan(
  input: OptimizerInput,
  currentAssignments: readonly AssignmentSummary[],
): OptimizeOutcome {
  return runOptimizer(input, currentAssignments);
}
