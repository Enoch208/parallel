import type { AssignmentSummary } from "../model/types";
import type { ObjectiveBounds } from "./bounds";
import { buildObjectiveBounds, fitsExactSearch, upperBoundForPlan, upperBoundFrom } from "./bounds";
import { runBeamSearch } from "./beam";
import { DUPLICATE_ATTENDANCE_PENALTY, INTEREST_BONUS, REPAIR_CHANGE_PENALTY } from "./constants";
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
import type { OptimizerInput, ProvenOutcome } from "./types";

export const EXACT_NODE_BUDGET = 120000;

const SCORE_EPSILON = 1e-9;

interface ExactSearch {
  readonly plan: SearchPlan;
  readonly bounds: ObjectiveBounds;
  readonly choices: number[][];
  readonly attendeeCounts: number[];
  products: number[];
  duplicates: number;
  interestHits: number;
  changes: number;
  best: number;
  bestChoices: number[][];
  bestChanges: number;
  nodes: number;
  exhausted: boolean;
}

function changeCost(
  plan: SearchPlan,
  memberIndex: number,
  windowIndex: number,
  option: number,
): number {
  if (plan.current === null) return 0;
  return itemAt(itemAt(plan.current, memberIndex), windowIndex) === option ? 0 : 1;
}

function conflictsWithTaken(
  plan: SearchPlan,
  taken: readonly number[],
  windowIndex: number,
  sessionIndex: number,
): boolean {
  const candidate = itemAt(plan.context.sessions, sessionIndex);
  for (let earlier = 0; earlier < windowIndex; earlier += 1) {
    const chosen = itemAt(taken, earlier);
    if (chosen === NO_SESSION) continue;
    if (overlaps(itemAt(plan.context.sessions, chosen), candidate)) return true;
  }
  return false;
}

function optionsFor(
  plan: SearchPlan,
  taken: readonly number[],
  windowIndex: number,
  memberIndex: number,
): number[] {
  const forced = itemAt(itemAt(plan.forced, memberIndex), windowIndex);
  if (forced !== NO_SESSION) return [forced];
  const allowedRow = itemAt(plan.allowed, memberIndex);
  const options: number[] = [];
  for (const sessionIndex of itemAt(plan.context.windows, windowIndex)) {
    if (!itemAt(allowedRow, sessionIndex)) continue;
    if (conflictsWithTaken(plan, taken, windowIndex, sessionIndex)) continue;
    options.push(sessionIndex);
  }
  options.push(NO_SESSION);
  return options;
}

function recordLeaf(search: ExactSearch): void {
  const score =
    teamGoalCoverage(search.plan.context, search.products) +
    INTEREST_BONUS * search.interestHits -
    DUPLICATE_ATTENDANCE_PENALTY * search.duplicates -
    REPAIR_CHANGE_PENALTY * search.changes;
  if (score <= search.best + SCORE_EPSILON) return;
  search.best = score;
  search.bestChanges = search.changes;
  search.bestChoices = search.choices.map((row) => [...row]);
}

function applyOption(
  search: ExactSearch,
  memberIndex: number,
  windowIndex: number,
  option: number,
): number[] {
  const previousProducts = search.products;
  itemAt(search.choices, memberIndex)[windowIndex] = option;
  search.changes += changeCost(search.plan, memberIndex, windowIndex, option);
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
  search: ExactSearch,
  memberIndex: number,
  windowIndex: number,
  option: number,
  previousProducts: number[],
): void {
  search.changes -= changeCost(search.plan, memberIndex, windowIndex, option);
  itemAt(search.choices, memberIndex)[windowIndex] = NO_SESSION;
  search.products = previousProducts;
  if (option === NO_SESSION) return;
  const attending = itemAt(search.attendeeCounts, option) - 1;
  search.attendeeCounts[option] = attending;
  if (attending > 0) search.duplicates -= 1;
  if (itemAt(itemAt(search.plan.interested, memberIndex), option)) search.interestHits -= 1;
}

function exploreSlot(search: ExactSearch, slotIndex: number): void {
  const memberCount = search.plan.context.members.length;
  if (slotIndex === memberCount * search.plan.context.windows.length) {
    recordLeaf(search);
    return;
  }
  const bound = upperBoundFrom(search.plan, search.bounds, {
    slotIndex,
    products: search.products,
    interestHits: search.interestHits,
    duplicates: search.duplicates,
    changes: search.changes,
  });
  if (bound <= search.best + SCORE_EPSILON) return;
  if (search.nodes >= EXACT_NODE_BUDGET) {
    search.exhausted = true;
    return;
  }
  search.nodes += 1;
  const windowIndex = Math.floor(slotIndex / memberCount);
  const memberIndex = slotIndex - windowIndex * memberCount;
  const taken = itemAt(search.choices, memberIndex);
  for (const option of optionsFor(search.plan, taken, windowIndex, memberIndex)) {
    const previousProducts = applyOption(search, memberIndex, windowIndex, option);
    exploreSlot(search, slotIndex + 1);
    undoOption(search, memberIndex, windowIndex, option, previousProducts);
    if (search.exhausted) return;
  }
}

function beamChoices(plan: SearchPlan): { choices: number[][]; changes: number; score: number } {
  const state = runBeamSearch(plan);
  const choices = plan.context.members.map(() =>
    new Array<number>(plan.context.windows.length).fill(NO_SESSION),
  );
  state.memberSessions.forEach((sessions, memberIndex) => {
    for (const sessionIndex of sessions) {
      const windowIndex = valueFor(plan.context.windowOfSession, sessionIndex, "time window");
      itemAt(choices, memberIndex)[windowIndex] = sessionIndex;
    }
  });
  return { choices, changes: state.changes, score: state.score };
}

function assignmentsFromChoices(
  plan: SearchPlan,
  choices: readonly (readonly number[])[],
): AssignmentSummary[] {
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

function outcomeFrom(
  plan: SearchPlan,
  choices: readonly (readonly number[])[],
  changes: number,
  proof: { status: "optimal" | "heuristic"; nodesExplored: number },
): ProvenOutcome {
  const assignments = assignmentsFromChoices(plan, choices);
  const coverage = coverageSummaryFromContext(plan.context, assignments);
  const hits = interestHitCount(plan.context, plan.interested, assignments);
  const objective = breakdownFrom(
    coverage.teamGoalCoverage,
    hits,
    coverage.duplicateAttendances,
    changes,
  );
  const upperBound = proof.status === "optimal" ? objective.objective : upperBoundForPlan(plan);
  return {
    kind: "plan",
    status: proof.status,
    assignments,
    coverage,
    objective,
    upperBound,
    gap: upperBound - objective.objective,
    nodesExplored: proof.nodesExplored,
  };
}

function solveWithProof(
  input: OptimizerInput,
  current: readonly AssignmentSummary[] | null,
): ProvenOutcome {
  const conflicts = findPinConflicts(input);
  if (conflicts.length > 0) {
    return {
      kind: "infeasible",
      blockingPinnedSessionIds: blockingPinnedSessionIds(conflicts),
      conflicts,
    };
  }
  const plan = buildSearchPlan(input, current);
  const beam = beamChoices(plan);
  if (!fitsExactSearch(plan)) {
    return outcomeFrom(plan, beam.choices, beam.changes, {
      status: "heuristic",
      nodesExplored: 0,
    });
  }
  const search: ExactSearch = {
    plan,
    bounds: buildObjectiveBounds(plan),
    choices: plan.context.members.map(() =>
      new Array<number>(plan.context.windows.length).fill(NO_SESSION),
    ),
    attendeeCounts: new Array<number>(plan.context.sessions.length).fill(0),
    products: untouchedProducts(plan.context.goals.length),
    duplicates: 0,
    interestHits: 0,
    changes: 0,
    best: beam.score,
    bestChoices: beam.choices,
    bestChanges: beam.changes,
    nodes: 0,
    exhausted: false,
  };
  exploreSlot(search, 0);
  return outcomeFrom(plan, search.bestChoices, search.bestChanges, {
    status: search.exhausted ? "heuristic" : "optimal",
    nodesExplored: search.nodes,
  });
}

export function optimizePlanWithProof(input: OptimizerInput): ProvenOutcome {
  return solveWithProof(input, null);
}

export function repairPlanWithProof(
  input: OptimizerInput,
  currentAssignments: readonly AssignmentSummary[],
): ProvenOutcome {
  return solveWithProof(input, currentAssignments);
}
