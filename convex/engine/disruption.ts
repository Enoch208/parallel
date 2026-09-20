import type { AssignmentSummary, CoverageSummary, SessionSummary } from "../model/types";
import type { ObjectiveBounds } from "./bounds";
import { buildObjectiveBounds } from "./bounds";
import {
  coverageSummaryFromContext,
  productsWithSession,
  teamGoalCoverage,
  untouchedProducts,
} from "./coverage";
import { blockingPinnedSessionIds, findPinConflicts } from "./feasibility";
import { overlaps } from "./intervals";
import { itemAt, valueFor } from "./lookup";
import { breakdownFrom, interestHitCount } from "./objective";
import { describeAssignment } from "./reasons";
import type { SearchPlan } from "./searchPlan";
import { buildSearchPlan, NO_SESSION } from "./searchPlan";
import type {
  InfeasibleOutcome,
  ObjectiveBreakdown,
  OptimizerInput,
  SolutionStatus,
} from "./types";

export const DISRUPTION_NODE_BUDGET = 150000;

const COVERAGE_EPSILON = 1e-9;

export interface DisruptionPlanOutcome {
  readonly kind: "plan";
  readonly assignments: readonly AssignmentSummary[];
  readonly coverage: CoverageSummary;
  readonly objective: ObjectiveBreakdown;
  readonly minimumChangedMembers: number;
  readonly mustChangeMemberIds: readonly string[];
  readonly changedAssignments: number;
  readonly status: SolutionStatus;
  readonly nodesExplored: number;
}

export type DisruptionOutcome = DisruptionPlanOutcome | InfeasibleOutcome;

type Choices = readonly (readonly number[])[];

interface DisruptionQuality {
  readonly changedAssignments: number;
  readonly teamGoalCoverage: number;
  readonly interestHits: number;
  readonly duplicates: number;
}

function compareQuality(left: DisruptionQuality, right: DisruptionQuality): number {
  if (left.changedAssignments !== right.changedAssignments) {
    return left.changedAssignments - right.changedAssignments;
  }
  const byCoverage = right.teamGoalCoverage - left.teamGoalCoverage;
  if (Math.abs(byCoverage) > COVERAGE_EPSILON) return byCoverage;
  if (left.interestHits !== right.interestHits) return right.interestHits - left.interestHits;
  return left.duplicates - right.duplicates;
}

export function currentChoices(
  plan: SearchPlan,
  assignments: readonly AssignmentSummary[],
): number[][] {
  const choices = plan.context.members.map(() =>
    new Array<number>(plan.context.windows.length).fill(NO_SESSION),
  );
  for (const assignment of assignments) {
    const memberIndex = plan.context.memberIndexById.get(assignment.membershipId);
    const sessionIndex = plan.context.sessionIndexById.get(assignment.sessionId);
    if (memberIndex === undefined || sessionIndex === undefined) continue;
    const windowIndex = valueFor(plan.context.windowOfSession, sessionIndex, "time window");
    itemAt(choices, memberIndex)[windowIndex] = sessionIndex;
  }
  return choices;
}

export function memberMustChange(
  plan: SearchPlan,
  baseline: Choices,
  memberIndex: number,
): boolean {
  const row = itemAt(baseline, memberIndex);
  const allowedRow = itemAt(plan.allowed, memberIndex);
  const forcedRow = itemAt(plan.forced, memberIndex);
  const held: number[] = [];
  for (let windowIndex = 0; windowIndex < row.length; windowIndex += 1) {
    const choice = itemAt(row, windowIndex);
    const pinned = itemAt(forcedRow, windowIndex);
    if (pinned !== NO_SESSION && pinned !== choice) return true;
    if (choice === NO_SESSION) continue;
    if (!itemAt(allowedRow, choice)) return true;
    held.push(choice);
  }
  for (let left = 0; left < held.length; left += 1) {
    for (let right = left + 1; right < held.length; right += 1) {
      const first = itemAt(plan.context.sessions, itemAt(held, left));
      const second = itemAt(plan.context.sessions, itemAt(held, right));
      if (overlaps(first, second)) return true;
    }
  }
  return false;
}

function freezeExcept(plan: SearchPlan, baseline: Choices, free: ReadonlySet<number>): SearchPlan {
  const allowed = plan.allowed.map((row) => [...row]);
  const forced = plan.forced.map((row) => [...row]);
  plan.context.members.forEach((_member, memberIndex) => {
    if (free.has(memberIndex)) return;
    itemAt(baseline, memberIndex).forEach((choice, windowIndex) => {
      if (choice !== NO_SESSION) {
        itemAt(forced, memberIndex)[windowIndex] = choice;
        return;
      }
      for (const sessionIndex of itemAt(plan.context.windows, windowIndex)) {
        itemAt(allowed, memberIndex)[sessionIndex] = false;
      }
    });
  });
  return { ...plan, allowed, forced };
}

function pinsOnly(plan: SearchPlan, baseline: Choices, free: ReadonlySet<number>): number[][] {
  return plan.context.members.map((_member, memberIndex) =>
    free.has(memberIndex)
      ? [...itemAt(plan.forced, memberIndex)]
      : [...itemAt(baseline, memberIndex)],
  );
}

interface DisruptionSearch {
  readonly plan: SearchPlan;
  readonly baseline: Choices;
  readonly bounds: ObjectiveBounds;
  readonly choices: number[][];
  readonly attendeeCounts: number[];
  products: number[];
  duplicates: number;
  interestHits: number;
  changedAssignments: number;
  best: DisruptionQuality | null;
  bestChoices: number[][] | null;
  budget: number;
  truncated: boolean;
}

function clashesWithEarlierWindow(
  sessions: readonly SessionSummary[],
  taken: readonly number[],
  windowIndex: number,
  sessionIndex: number,
): boolean {
  const candidate = itemAt(sessions, sessionIndex);
  for (let earlier = 0; earlier < windowIndex; earlier += 1) {
    const chosen = itemAt(taken, earlier);
    if (chosen !== NO_SESSION && overlaps(itemAt(sessions, chosen), candidate)) return true;
  }
  return false;
}

function optionsFor(search: DisruptionSearch, memberIndex: number, windowIndex: number): number[] {
  const forced = itemAt(itemAt(search.plan.forced, memberIndex), windowIndex);
  if (forced !== NO_SESSION) return [forced];
  const sessions = search.plan.context.sessions;
  const allowedRow = itemAt(search.plan.allowed, memberIndex);
  const taken = itemAt(search.choices, memberIndex);
  const options = itemAt(search.plan.context.windows, windowIndex).filter(
    (sessionIndex) =>
      itemAt(allowedRow, sessionIndex) &&
      !clashesWithEarlierWindow(sessions, taken, windowIndex, sessionIndex),
  );
  return [...options, NO_SESSION];
}

function applyOption(
  search: DisruptionSearch,
  memberIndex: number,
  windowIndex: number,
  option: number,
): number[] {
  const previousProducts = search.products;
  itemAt(search.choices, memberIndex)[windowIndex] = option;
  if (itemAt(itemAt(search.baseline, memberIndex), windowIndex) !== option) {
    search.changedAssignments += 1;
  }
  if (option === NO_SESSION) return previousProducts;
  const attending = itemAt(search.attendeeCounts, option);
  search.attendeeCounts[option] = attending + 1;
  if (attending === 0) {
    search.products = productsWithSession(search.plan.context, search.products, option);
  } else {
    search.duplicates += 1;
  }
  if (itemAt(itemAt(search.plan.interested, memberIndex), option)) search.interestHits += 1;
  return previousProducts;
}

function undoOption(
  search: DisruptionSearch,
  memberIndex: number,
  windowIndex: number,
  option: number,
  previousProducts: number[],
): void {
  if (itemAt(itemAt(search.baseline, memberIndex), windowIndex) !== option) {
    search.changedAssignments -= 1;
  }
  itemAt(search.choices, memberIndex)[windowIndex] = NO_SESSION;
  search.products = previousProducts;
  if (option === NO_SESSION) return;
  const attending = itemAt(search.attendeeCounts, option) - 1;
  search.attendeeCounts[option] = attending;
  if (attending > 0) search.duplicates -= 1;
  if (itemAt(itemAt(search.plan.interested, memberIndex), option)) search.interestHits -= 1;
}

function optimisticQuality(search: DisruptionSearch, slotIndex: number): DisruptionQuality {
  const memberCount = search.plan.context.members.length;
  const windowCount = search.plan.context.windows.length;
  const windowIndex =
    memberCount === 0 ? windowCount : Math.min(Math.floor(slotIndex / memberCount), windowCount);
  const suffix = itemAt(search.bounds.factorSuffix, windowIndex);
  return {
    changedAssignments: search.changedAssignments,
    teamGoalCoverage: teamGoalCoverage(
      search.plan.context,
      search.products.map((product, goalIndex) => product * itemAt(suffix, goalIndex)),
    ),
    interestHits: search.interestHits + itemAt(search.bounds.interestSuffix, slotIndex),
    duplicates: search.duplicates,
  };
}

function explore(search: DisruptionSearch, slotIndex: number): void {
  const memberCount = search.plan.context.members.length;
  if (slotIndex === memberCount * search.plan.context.windows.length) {
    const leaf: DisruptionQuality = {
      changedAssignments: search.changedAssignments,
      teamGoalCoverage: teamGoalCoverage(search.plan.context, search.products),
      interestHits: search.interestHits,
      duplicates: search.duplicates,
    };
    if (search.best !== null && compareQuality(leaf, search.best) >= 0) return;
    search.best = leaf;
    search.bestChoices = search.choices.map((row) => [...row]);
    return;
  }
  if (
    search.best !== null &&
    compareQuality(optimisticQuality(search, slotIndex), search.best) >= 0
  )
    return;
  if (search.budget <= 0) {
    search.truncated = true;
    return;
  }
  search.budget -= 1;
  const windowIndex = Math.floor(slotIndex / memberCount);
  const memberIndex = slotIndex - windowIndex * memberCount;
  for (const option of optionsFor(search, memberIndex, windowIndex)) {
    const previousProducts = applyOption(search, memberIndex, windowIndex, option);
    explore(search, slotIndex + 1);
    undoOption(search, memberIndex, windowIndex, option, previousProducts);
    if (search.truncated) return;
  }
}

function assignmentsFrom(plan: SearchPlan, choices: Choices): AssignmentSummary[] {
  const assignments: AssignmentSummary[] = [];
  plan.context.members.forEach((member, memberIndex) => {
    itemAt(choices, memberIndex).forEach((sessionIndex, windowIndex) => {
      if (sessionIndex === NO_SESSION) return;
      const pinned = itemAt(itemAt(plan.forced, memberIndex), windowIndex) === sessionIndex;
      const interested = itemAt(itemAt(plan.interested, memberIndex), sessionIndex);
      assignments.push({
        sessionId: itemAt(plan.context.sessions, sessionIndex).id,
        membershipId: member.id,
        pinned,
        reason: describeAssignment(plan.context, sessionIndex, pinned, interested),
      });
    });
  });
  return assignments;
}

function countChangedAssignments(baseline: Choices, choices: Choices): number {
  return baseline.reduce(
    (total, row, memberIndex) =>
      total +
      row.filter((choice, index) => choice !== itemAt(itemAt(choices, memberIndex), index)).length,
    0,
  );
}

function startSearch(plan: SearchPlan, frozen: SearchPlan, baseline: Choices): DisruptionSearch {
  return {
    plan: frozen,
    baseline,
    bounds: buildObjectiveBounds(frozen),
    choices: plan.context.members.map(() =>
      new Array<number>(plan.context.windows.length).fill(NO_SESSION),
    ),
    attendeeCounts: new Array<number>(plan.context.sessions.length).fill(0),
    products: untouchedProducts(plan.context.goals.length),
    duplicates: 0,
    interestHits: 0,
    changedAssignments: 0,
    best: null,
    bestChoices: null,
    budget: DISRUPTION_NODE_BUDGET,
    truncated: false,
  };
}

export function repairWithMinimumDisruption(
  input: OptimizerInput,
  currentAssignments: readonly AssignmentSummary[],
): DisruptionOutcome {
  const conflicts = findPinConflicts(input);
  if (conflicts.length > 0) {
    return {
      kind: "infeasible",
      blockingPinnedSessionIds: blockingPinnedSessionIds(conflicts),
      conflicts,
    };
  }
  const plan = buildSearchPlan(input, null);
  const baseline = currentChoices(plan, currentAssignments);
  const mustChange = new Set(
    plan.context.members
      .map((_member, memberIndex) => memberIndex)
      .filter((memberIndex) => memberMustChange(plan, baseline, memberIndex)),
  );
  const search = startSearch(plan, freezeExcept(plan, baseline, mustChange), baseline);
  explore(search, 0);
  const choices = search.bestChoices ?? pinsOnly(plan, baseline, mustChange);
  const assignments = assignmentsFrom(plan, choices);
  const coverage = coverageSummaryFromContext(plan.context, assignments);
  const hits = interestHitCount(plan.context, plan.interested, assignments);
  const changedAssignments = countChangedAssignments(baseline, choices);
  return {
    kind: "plan",
    assignments,
    coverage,
    objective: breakdownFrom(
      coverage.teamGoalCoverage,
      hits,
      coverage.duplicateAttendances,
      changedAssignments,
    ),
    minimumChangedMembers: mustChange.size,
    mustChangeMemberIds: plan.context.members
      .filter((_member, memberIndex) => mustChange.has(memberIndex))
      .map((member) => member.id),
    changedAssignments,
    status: search.truncated ? "heuristic" : "optimal",
    nodesExplored: DISRUPTION_NODE_BUDGET - search.budget,
  };
}
