import type { AssignmentSummary, CoverageSummary, GoalCoverage } from "../model/types";
import { maxAttendableIntervals } from "./attendable";
import { RELEVANCE_ABSORPTION } from "./constants";
import type { EngineContext } from "./context";
import { buildEngineContext } from "./context";
import { itemAt, valueFor } from "./lookup";
import type { CoverageInput } from "./types";

export function absorptionFactor(relevance: number): number {
  return 1 - RELEVANCE_ABSORPTION * relevance;
}

export function untouchedProducts(goalCount: number): number[] {
  return new Array<number>(goalCount).fill(1);
}

export function productsWithSession(
  context: EngineContext,
  products: readonly number[],
  sessionIndex: number,
): number[] {
  const row = itemAt(context.relevance, sessionIndex);
  return products.map((product, goalIndex) => product * absorptionFactor(itemAt(row, goalIndex)));
}

export function productsForSessions(
  context: EngineContext,
  sessionIndices: Iterable<number>,
): number[] {
  let products: readonly number[] = untouchedProducts(context.goals.length);
  for (const sessionIndex of sessionIndices) {
    products = productsWithSession(context, products, sessionIndex);
  }
  return [...products];
}

export function teamGoalCoverage(context: EngineContext, products: readonly number[]): number {
  if (context.weightTotal <= 0) return 0;
  let weighted = 0;
  for (let goalIndex = 0; goalIndex < context.goals.length; goalIndex += 1) {
    weighted += itemAt(context.weights, goalIndex) * (1 - itemAt(products, goalIndex));
  }
  return (100 * weighted) / context.weightTotal;
}

export function attendeesBySessionIndex(
  context: EngineContext,
  assignments: readonly AssignmentSummary[],
): Map<number, Set<string>> {
  const attendees = new Map<number, Set<string>>();
  for (const assignment of assignments) {
    const sessionIndex = valueFor(context.sessionIndexById, assignment.sessionId, "session");
    valueFor(context.memberIndexById, assignment.membershipId, "membership");
    const existing = attendees.get(sessionIndex);
    if (existing === undefined) {
      attendees.set(sessionIndex, new Set([assignment.membershipId]));
      continue;
    }
    existing.add(assignment.membershipId);
  }
  return attendees;
}

function maxAttendableSessions(context: EngineContext): number {
  return maxAttendableIntervals(context.sessions, context.members.length);
}

export function coverageSummaryFromContext(
  context: EngineContext,
  assignments: readonly AssignmentSummary[],
): CoverageSummary {
  const attendees = attendeesBySessionIndex(context, assignments);
  const attendedIndices = [...attendees.keys()].sort((left, right) => left - right);
  const products = productsForSessions(context, attendedIndices);
  let duplicateAttendances = 0;
  for (const members of attendees.values()) duplicateAttendances += members.size - 1;
  const perGoal: GoalCoverage[] = context.goals.map((goal, goalIndex) => ({
    goalId: goal.id,
    label: goal.label,
    weight: goal.weight,
    coverage: 1 - itemAt(products, goalIndex),
  }));
  return {
    teamGoalCoverage: teamGoalCoverage(context, products),
    perGoal,
    uniqueSessions: attendedIndices.length,
    maxAttendableSessions: maxAttendableSessions(context),
    duplicateAttendances,
  };
}

export function computeCoverageSummary(
  input: CoverageInput,
  assignments: readonly AssignmentSummary[],
): CoverageSummary {
  return coverageSummaryFromContext(buildEngineContext(input), assignments);
}
