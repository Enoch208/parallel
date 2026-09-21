import { describe, expect, it } from "vitest";
import {
  currentChoices,
  DISRUPTION_NODE_BUDGET,
  memberMustChange,
  repairWithMinimumDisruption,
} from "../../convex/engine/disruption";
import type { DisruptionPlanOutcome } from "../../convex/engine/disruption";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { countMovedAssignments } from "../../convex/engine/planDiff";
import { buildSearchPlan } from "../../convex/engine/searchPlan";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { feasibleSchedules } from "./brute-force-optimum";
import { block, goal, member, score, session } from "./fixtures";
import { outcomeFailures } from "./invariants";
import type { InstanceShape } from "./random-instances";
import {
  createRandom,
  largeShape,
  mediumShape,
  randomInstance,
  smallShape,
  withExtraBlock,
} from "./random-instances";

const exhaustiveSearchBudget = { timeout: 30_000 };

const SWEEP_COUNT = 300;

const trackLabels = ["Alpha", "Beta", "Gamma"];
const windowStarts = [0, 2, 4];

const grid = windowStarts.flatMap((startHour, windowIndex) =>
  trackLabels.map((track, trackIndex) =>
    session(
      `w${String(windowIndex)}-t${String(trackIndex)}`,
      `${track} session in window ${String(windowIndex)}`,
      startHour,
      1,
      track,
    ),
  ),
);

const baseInput: OptimizerInput = {
  sessions: grid,
  goals: [goal("g1", "One shared goal", 3)],
  members: [member("m1", "Ada"), member("m2", "Brian"), member("m3", "Cleo")],
  scores: grid.map((entry) => score(entry.id, "g1", 0.5)),
  preferences: [],
  blocks: [],
};

function planAssignments(input: OptimizerInput): AssignmentSummary[] {
  const outcome = optimizePlan(input);
  if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
  return [...outcome.assignments];
}

function held(assignments: readonly AssignmentSummary[], membershipId: string): string[] {
  return assignments
    .filter((assignment) => assignment.membershipId === membershipId)
    .map((assignment) => assignment.sessionId)
    .sort();
}

function scheduleKey(sessions: readonly SessionSummary[]): string {
  return sessions
    .map((entry) => entry.id)
    .sort()
    .join("|");
}

function bruteForceMustChange(
  input: OptimizerInput,
  current: readonly AssignmentSummary[],
): string[] {
  return input.members
    .filter((teammate) => {
      const key = held(current, teammate.id).join("|");
      return !feasibleSchedules(input, teammate.id).some(
        (schedule) => scheduleKey(schedule) === key,
      );
    })
    .map((teammate) => teammate.id)
    .sort();
}

function changedMemberIds(
  input: OptimizerInput,
  current: readonly AssignmentSummary[],
  next: readonly AssignmentSummary[],
): string[] {
  return input.members
    .filter(
      (teammate) =>
        countMovedAssignments(
          input.sessions,
          current.filter((assignment) => assignment.membershipId === teammate.id),
          next.filter((assignment) => assignment.membershipId === teammate.id),
        ) > 0,
    )
    .map((teammate) => teammate.id)
    .sort();
}

function repaired(
  input: OptimizerInput,
  current: readonly AssignmentSummary[],
): DisruptionPlanOutcome {
  const outcome = repairWithMinimumDisruption(input, current);
  if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
  return outcome;
}

describe("minimum-disruption repair", () => {
  it("proves nobody has to move when the revision touches nobody", () => {
    const current = planAssignments(baseInput);
    const revised: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 6, 1, "Dinner after the last session")],
    };
    const outcome = repaired(revised, current);
    expect(outcome.minimumChangedMembers).toBe(0);
    expect(outcome.mustChangeMemberIds).toEqual([]);
    expect(outcome.changedAssignments).toBe(0);
    expect(outcome.status).toBe("optimal");
    for (const teammate of revised.members) {
      expect(held(outcome.assignments, teammate.id)).toEqual(held(current, teammate.id));
    }
  });

  it("proves exactly one when a block lands on one teammate's slot", () => {
    const current = planAssignments(baseInput);
    expect(held(current, "m1")).toHaveLength(3);
    const revised: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 0, 1, "Customer escalation")],
    };
    const outcome = repaired(revised, current);
    expect(outcome.minimumChangedMembers).toBe(1);
    expect(outcome.mustChangeMemberIds).toEqual(["m1"]);
    expect(changedMemberIds(revised, current, outcome.assignments)).toEqual(["m1"]);
    expect(bruteForceMustChange(revised, current)).toEqual(["m1"]);
    expect(held(outcome.assignments, "m2")).toEqual(held(current, "m2"));
    expect(held(outcome.assignments, "m3")).toEqual(held(current, "m3"));
    expect(outcomeFailures(revised, outcome)).toEqual([]);
  });

  it("proves exactly two when two teammates lose a slot, and brute force agrees", () => {
    const current = planAssignments(baseInput);
    const revised: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 0, 1, "Customer escalation"), block("m2", 2, 1, "Board call")],
    };
    const outcome = repaired(revised, current);
    expect(outcome.minimumChangedMembers).toBe(2);
    expect(outcome.mustChangeMemberIds).toEqual(["m1", "m2"]);
    expect(changedMemberIds(revised, current, outcome.assignments)).toEqual(["m1", "m2"]);
    expect(bruteForceMustChange(revised, current)).toEqual(["m1", "m2"]);
    expect(held(outcome.assignments, "m3")).toEqual(held(current, "m3"));
    expect(outcomeFailures(revised, outcome)).toEqual([]);
  });

  it("returns an identical result for an identical input", () => {
    const current = planAssignments(baseInput);
    const revised: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 0, 1, "Customer escalation"), block("m3", 4, 1, "Flight home")],
    };
    const first = repairWithMinimumDisruption(revised, current);
    const second = repairWithMinimumDisruption(revised, current);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("refuses to plan around a pin it cannot satisfy", () => {
    const current = planAssignments(baseInput);
    const revised: OptimizerInput = {
      ...baseInput,
      preferences: [{ membershipId: "m1", sessionId: "w0-t0", stance: "pinned" }],
      blocks: [block("m1", 0, 1, "Customer escalation")],
    };
    const outcome = repairWithMinimumDisruption(revised, current);
    expect(outcome.kind).toBe("infeasible");
    if (outcome.kind !== "infeasible") throw new Error("Expected infeasible");
    expect(outcome.blockingPinnedSessionIds).toEqual(["w0-t0"]);
  });
});

interface SweepTotals {
  readonly failures: string[];
  checked: number;
  optimal: number;
  beatsPenaltyRepair: number;
  membersSaved: number;
  readonly byMinimum: Map<number, number>;
}

function extraBlocks(input: OptimizerInput, seed: number, howMany: number): OptimizerInput {
  const random = createRandom(seed + 104729);
  let revised = input;
  for (let index = 0; index < howMany; index += 1) {
    revised = withExtraBlock(revised, Math.floor(random() * 100000));
  }
  return revised;
}

function checkOutcome(
  name: string,
  revised: OptimizerInput,
  current: readonly AssignmentSummary[],
  outcome: DisruptionPlanOutcome,
): string[] {
  const failures = outcomeFailures(revised, outcome).map((failure) => `${name}: ${failure}`);
  const certified = [...outcome.mustChangeMemberIds];
  const trueMustChange = bruteForceMustChange(revised, current);
  if (JSON.stringify(certified) !== JSON.stringify(trueMustChange)) {
    failures.push(
      `${name}: certified ${certified.join(",")} against brute force ${trueMustChange.join(",")}`,
    );
  }
  if (outcome.minimumChangedMembers !== certified.length) {
    failures.push(`${name}: minimum disagrees with its own certificate`);
  }
  const moved = changedMemberIds(revised, current, outcome.assignments);
  if (JSON.stringify(moved) !== JSON.stringify(certified)) {
    failures.push(`${name}: moved ${moved.join(",")} but proved ${certified.join(",")}`);
  }
  const movedSlots = countMovedAssignments(revised.sessions, current, outcome.assignments);
  if (movedSlots !== outcome.changedAssignments) {
    failures.push(
      `${name}: reported ${String(outcome.changedAssignments)} moves, the plan diff says ${String(movedSlots)}`,
    );
  }
  return failures;
}

function sweep(
  label: string,
  shape: InstanceShape,
  count: number,
  perturbations: number,
  totals: SweepTotals,
): void {
  for (let seed = 1; seed <= count; seed += 1) {
    const input = randomInstance(seed, shape);
    const base = optimizePlan(input);
    if (base.kind !== "plan") continue;
    const revised = extraBlocks(input, seed, perturbations);
    const outcome = repairWithMinimumDisruption(revised, base.assignments);
    if (outcome.kind !== "plan") continue;
    const name = `${label} seed ${String(seed)}`;
    totals.checked += 1;
    if (outcome.status === "optimal") totals.optimal += 1;
    totals.failures.push(...checkOutcome(name, revised, base.assignments, outcome));
    const minimum = outcome.minimumChangedMembers;
    totals.byMinimum.set(minimum, (totals.byMinimum.get(minimum) ?? 0) + 1);
    const penalty = repairPlan(revised, base.assignments);
    if (penalty.kind !== "plan") continue;
    const penaltyMembers = changedMemberIds(revised, base.assignments, penalty.assignments).length;
    if (minimum > penaltyMembers) {
      totals.failures.push(
        `${name}: proved ${String(minimum)} above penalty repair's ${String(penaltyMembers)}`,
      );
    }
    if (penaltyMembers > minimum) {
      totals.beatsPenaltyRepair += 1;
      totals.membersSaved += penaltyMembers - minimum;
    }
  }
}

describe("minimum-disruption repair over generated revisions", exhaustiveSearchBudget, () => {
  it("certifies a minimum that brute force confirms and penalty repair never beats", () => {
    const totals: SweepTotals = {
      failures: [],
      checked: 0,
      optimal: 0,
      beatsPenaltyRepair: 0,
      membersSaved: 0,
      byMinimum: new Map<number, number>(),
    };
    sweep("small/1", smallShape, SWEEP_COUNT, 1, totals);
    sweep("small/3", smallShape, SWEEP_COUNT, 3, totals);
    sweep("medium/1", mediumShape, SWEEP_COUNT, 1, totals);
    sweep("medium/3", mediumShape, SWEEP_COUNT, 3, totals);
    sweep("large/4", largeShape, SWEEP_COUNT, 4, totals);
    expect(totals.failures).toEqual([]);
    expect(totals.checked).toBeGreaterThanOrEqual(SWEEP_COUNT);
    expect(totals.byMinimum.get(0) ?? 0).toBeGreaterThan(0);
    expect(totals.byMinimum.get(1) ?? 0).toBeGreaterThan(0);
    expect(totals.byMinimum.get(2) ?? 0).toBeGreaterThan(0);
    expect(totals.beatsPenaltyRepair).toBeGreaterThan(0);
  });

  it("forces a teammate to move only when no feasible schedule keeps their day", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= SWEEP_COUNT; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const base = optimizePlan(input);
      if (base.kind !== "plan") continue;
      const revised = extraBlocks(input, seed, 2);
      if (repairWithMinimumDisruption(revised, base.assignments).kind !== "plan") continue;
      const plan = buildSearchPlan(revised, null);
      const baseline = currentChoices(plan, base.assignments);
      const stuck = new Set(bruteForceMustChange(revised, base.assignments));
      plan.context.members.forEach((teammate, memberIndex) => {
        if (memberMustChange(plan, baseline, memberIndex) === stuck.has(teammate.id)) return;
        failures.push(`seed ${String(seed)}: ${teammate.id} was classified against brute force`);
      });
    }
    expect(failures).toEqual([]);
  });
});

const wideWindows = Array.from({ length: 16 }, (_unused, index) => index * 2);
const wideTracks = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const wideGrid = wideWindows.flatMap((startHour, windowIndex) =>
  wideTracks.map((track, trackIndex) =>
    session(
      `x${String(windowIndex)}-${String(trackIndex)}`,
      `${track} at ${String(startHour)}`,
      startHour,
      1,
      track,
    ),
  ),
);

const wideMembers = Array.from({ length: 16 }, (_unused, index) =>
  member(`p${String(index)}`, `Teammate ${String(index)}`),
);

const wideInput: OptimizerInput = {
  sessions: wideGrid,
  goals: [goal("ga", "Ship faster", 3), goal("gb", "Hire better", 2)],
  members: wideMembers,
  scores: wideGrid.flatMap((entry, index) => [
    score(entry.id, "ga", ((index % 7) + 2) / 10),
    score(entry.id, "gb", ((index % 5) + 1) / 10),
  ]),
  preferences: [],
  blocks: [],
};

describe("minimum-disruption repair under a work budget", () => {
  it("reports a heuristic tie-break instead of pretending it finished", () => {
    const current = planAssignments(wideInput);
    const revised: OptimizerInput = {
      ...wideInput,
      blocks: wideMembers.map((teammate) => block(teammate.id, 0, 1, "Standup overran")),
    };
    const outcome = repaired(revised, current);
    expect(outcome.status).toBe("heuristic");
    expect(outcome.nodesExplored).toBe(DISRUPTION_NODE_BUDGET);
    expect(outcome.minimumChangedMembers).toBe(outcome.mustChangeMemberIds.length);
    expect(changedMemberIds(revised, current, outcome.assignments)).toEqual([
      ...outcome.mustChangeMemberIds,
    ]);
    expect(outcomeFailures(revised, outcome)).toEqual([]);
  });
});
