import { DUPLICATE_ATTENDANCE_PENALTY, INTEREST_BONUS, REPAIR_CHANGE_PENALTY } from "./constants";
import { absorptionFactor, teamGoalCoverage, untouchedProducts } from "./coverage";
import { itemAt } from "./lookup";
import type { SearchPlan } from "./searchPlan";
import { buildSearchPlan, NO_SESSION } from "./searchPlan";
import type { OptimizerInput } from "./types";

export const EXACT_SEARCH_LOG2_LIMIT = 40;

export interface ObjectiveBounds {
  readonly factorSuffix: readonly (readonly number[])[];
  readonly interestSuffix: readonly number[];
}

export interface PartialObjective {
  readonly slotIndex: number;
  readonly products: readonly number[];
  readonly interestHits: number;
  readonly duplicates: number;
  readonly changes: number;
}

function attendableSessions(plan: SearchPlan, windowSessions: readonly number[]): number[] {
  return windowSessions.filter((sessionIndex) =>
    plan.allowed.some((row) => itemAt(row, sessionIndex)),
  );
}

function bestFactorsForWindow(plan: SearchPlan, windowSessions: readonly number[]): number[] {
  const attendable = attendableSessions(plan, windowSessions);
  const capacity = Math.min(plan.context.members.length, attendable.length);
  const factors: number[] = [];
  for (let goalIndex = 0; goalIndex < plan.context.goals.length; goalIndex += 1) {
    const ranked = attendable
      .map((sessionIndex) =>
        absorptionFactor(itemAt(itemAt(plan.context.relevance, sessionIndex), goalIndex)),
      )
      .sort((left, right) => left - right);
    let product = 1;
    for (let rank = 0; rank < capacity; rank += 1) product *= itemAt(ranked, rank);
    factors.push(product);
  }
  return factors;
}

function factorSuffixes(plan: SearchPlan): number[][] {
  const goalCount = plan.context.goals.length;
  const suffixes: number[][] = [new Array<number>(goalCount).fill(1)];
  for (let windowIndex = plan.context.windows.length - 1; windowIndex >= 0; windowIndex -= 1) {
    const later = itemAt(suffixes, suffixes.length - 1);
    const here = bestFactorsForWindow(plan, itemAt(plan.context.windows, windowIndex));
    suffixes.push(here.map((factor, goalIndex) => factor * itemAt(later, goalIndex)));
  }
  return suffixes.reverse();
}

function hasReachableInterest(
  plan: SearchPlan,
  memberIndex: number,
  windowSessions: readonly number[],
): boolean {
  return windowSessions.some(
    (sessionIndex) =>
      itemAt(itemAt(plan.allowed, memberIndex), sessionIndex) &&
      itemAt(itemAt(plan.interested, memberIndex), sessionIndex),
  );
}

function interestSuffixes(plan: SearchPlan): number[] {
  const memberCount = plan.context.members.length;
  const reachable: boolean[] = [];
  for (const windowSessions of plan.context.windows) {
    for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
      reachable.push(hasReachableInterest(plan, memberIndex, windowSessions));
    }
  }
  const suffixes = new Array<number>(reachable.length + 1).fill(0);
  for (let slotIndex = reachable.length - 1; slotIndex >= 0; slotIndex -= 1) {
    suffixes[slotIndex] = itemAt(suffixes, slotIndex + 1) + (itemAt(reachable, slotIndex) ? 1 : 0);
  }
  return suffixes;
}

export function buildObjectiveBounds(plan: SearchPlan): ObjectiveBounds {
  return { factorSuffix: factorSuffixes(plan), interestSuffix: interestSuffixes(plan) };
}

function windowIndexForSlot(plan: SearchPlan, slotIndex: number): number {
  const memberCount = plan.context.members.length;
  if (memberCount === 0) return plan.context.windows.length;
  return Math.min(Math.floor(slotIndex / memberCount), plan.context.windows.length);
}

export function upperBoundFrom(
  plan: SearchPlan,
  bounds: ObjectiveBounds,
  partial: PartialObjective,
): number {
  const suffix = itemAt(bounds.factorSuffix, windowIndexForSlot(plan, partial.slotIndex));
  const products = partial.products.map(
    (product, goalIndex) => product * itemAt(suffix, goalIndex),
  );
  const reachableInterest = itemAt(bounds.interestSuffix, partial.slotIndex);
  return (
    teamGoalCoverage(plan.context, products) +
    INTEREST_BONUS * (partial.interestHits + reachableInterest) -
    DUPLICATE_ATTENDANCE_PENALTY * partial.duplicates -
    REPAIR_CHANGE_PENALTY * partial.changes
  );
}

export function upperBoundForPlan(plan: SearchPlan): number {
  return upperBoundFrom(plan, buildObjectiveBounds(plan), {
    slotIndex: 0,
    products: untouchedProducts(plan.context.goals.length),
    interestHits: 0,
    duplicates: 0,
    changes: 0,
  });
}

export function objectiveUpperBound(input: OptimizerInput): number {
  return upperBoundForPlan(buildSearchPlan(input, null));
}

export function searchSpaceLog2(plan: SearchPlan): number {
  let total = 0;
  plan.context.windows.forEach((windowSessions, windowIndex) => {
    for (let memberIndex = 0; memberIndex < plan.context.members.length; memberIndex += 1) {
      if (itemAt(itemAt(plan.forced, memberIndex), windowIndex) !== NO_SESSION) continue;
      const allowedRow = itemAt(plan.allowed, memberIndex);
      const open = windowSessions.filter((sessionIndex) => itemAt(allowedRow, sessionIndex)).length;
      total += Math.log2(open + 1);
    }
  });
  return total;
}

export function fitsExactSearch(plan: SearchPlan): boolean {
  return searchSpaceLog2(plan) <= EXACT_SEARCH_LOG2_LIMIT;
}

export function canSolveExactly(input: OptimizerInput): boolean {
  return fitsExactSearch(buildSearchPlan(input, null));
}
