import { describe, expect, it } from "vitest";
import { overlaps } from "../../convex/engine/intervals";
import { scoreAssignments } from "../../convex/engine/objective";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { countMovedAssignments } from "../../convex/engine/planDiff";
import { optimizePlanWithProof } from "../../convex/engine/exact";
import type { AssignmentSummary } from "../../convex/model/types";
import type { OptimizerInput } from "../../convex/engine/types";
import { outcomeFailures, sessionById } from "./invariants";
import { largeShape, mediumShape, randomInstance, withExtraBlock } from "./random-instances";
import { goal, member, score, session } from "./fixtures";

const exhaustiveSearchBudget = { timeout: 30_000 };

const INSTANCE_COUNT = 2000;
const REPAIR_COUNT = 600;
const DETERMINISM_COUNT = 400;
const TOLERANCE = 1e-9;

function currentAssignments(input: OptimizerInput): readonly AssignmentSummary[] | null {
  const outcome = optimizePlan(input);
  return outcome.kind === "plan" ? outcome.assignments : null;
}

function survivesBlocks(input: OptimizerInput, assignments: readonly AssignmentSummary[]): boolean {
  return !assignments.some((assignment) =>
    input.blocks.some(
      (entry) =>
        entry.membershipId === assignment.membershipId &&
        overlaps(entry, sessionById(input, assignment.sessionId)),
    ),
  );
}

describe("randomized optimizer invariants", exhaustiveSearchBudget, () => {
  it("holds every hard constraint over generated instances", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= INSTANCE_COUNT; seed += 1) {
      const shape = seed % 3 === 0 ? largeShape : mediumShape;
      const input = randomInstance(seed, shape);
      for (const failure of outcomeFailures(input, optimizePlan(input))) {
        failures.push(`seed ${String(seed)}: ${failure}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("returns an identical outcome when the same input is optimized twice", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= DETERMINISM_COUNT; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      if (JSON.stringify(optimizePlan(input)) !== JSON.stringify(optimizePlan(input))) {
        failures.push(`seed ${String(seed)} is not reproducible`);
      }
      const first = optimizePlanWithProof(input);
      if (JSON.stringify(first) !== JSON.stringify(optimizePlanWithProof(input))) {
        failures.push(`seed ${String(seed)} proof run is not reproducible`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("holds every hard constraint while repairing after a new block", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= REPAIR_COUNT; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const current = currentAssignments(input);
      if (current === null) continue;
      const changed = withExtraBlock(input, seed);
      for (const failure of outcomeFailures(changed, repairPlan(changed, current))) {
        failures.push(`seed ${String(seed)}: repair ${failure}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("moves nobody when repair runs against an unchanged input", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= REPAIR_COUNT; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const current = currentAssignments(input);
      if (current === null) continue;
      const repaired = repairPlan(input, current);
      if (repaired.kind !== "plan") {
        failures.push(`seed ${String(seed)}: repair turned a feasible plan infeasible`);
        continue;
      }
      const moved = countMovedAssignments(input.sessions, current, repaired.assignments);
      if (moved !== 0) failures.push(`seed ${String(seed)}: repair moved ${String(moved)} slots`);
    }
    expect(failures).toEqual([]);
  });

  it("never returns a repair that scores below keeping the current plan", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= REPAIR_COUNT; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const current = currentAssignments(input);
      if (current === null) continue;
      const changed = withExtraBlock(input, seed);
      if (!survivesBlocks(changed, current)) continue;
      const repaired = repairPlan(changed, current);
      if (repaired.kind !== "plan") continue;
      const keeping = scoreAssignments(changed, current).objective;
      if (repaired.objective.objective < keeping - TOLERANCE) {
        failures.push(
          `seed ${String(seed)}: repair scored ${String(repaired.objective.objective)} against ${String(keeping)} for standing still`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});

const threeSessionDay: OptimizerInput = {
  sessions: [
    session("early", "Opening keynote", 0, 1, "Main"),
    session("lateMain", "Main track talk", 2, 1, "Main"),
    session("lateSide", "Side track talk", 2, 1, "Side"),
  ],
  goals: [goal("g1", "One shared goal", 5)],
  members: [member("m0", "Ada"), member("m1", "Brian"), member("m2", "Cleo"), member("m3", "Dara")],
  scores: [score("early", "g1", 0.8), score("lateMain", "g1", 0.8), score("lateSide", "g1", 0.8)],
  preferences: [],
  blocks: [],
};

describe("what repair may do to an idle teammate", () => {
  it("hands a freed session to a teammate who held nothing before", () => {
    const base = optimizePlan(threeSessionDay);
    if (base.kind !== "plan") throw new Error("Expected a feasible plan");
    expect(base.coverage.uniqueSessions).toBe(3);
    expect(base.coverage.duplicateAttendances).toBe(0);
    const holder = base.assignments.find((entry) => entry.sessionId === "lateSide");
    if (holder === undefined) throw new Error("Expected the side talk to be covered");
    const busy = new Set(base.assignments.map((entry) => entry.membershipId));
    const idle = threeSessionDay.members.filter((entry) => !busy.has(entry.id));
    expect(idle.length).toBeGreaterThan(0);
    const changed: OptimizerInput = {
      ...threeSessionDay,
      blocks: [
        {
          membershipId: holder.membershipId,
          startsAt: sessionById(threeSessionDay, "lateSide").startsAt,
          endsAt: sessionById(threeSessionDay, "lateSide").endsAt,
          reason: "Customer escalation",
        },
      ],
    };
    const repaired = repairPlan(changed, base.assignments);
    if (repaired.kind !== "plan") throw new Error("Expected a feasible repair");
    const replacement = repaired.assignments.find((entry) => entry.sessionId === "lateSide");
    if (replacement === undefined) throw new Error("Expected the side talk to stay covered");
    expect(replacement.membershipId).not.toBe(holder.membershipId);
    expect(idle.map((entry) => entry.id)).toContain(replacement.membershipId);
    expect(repaired.coverage.uniqueSessions).toBe(3);
  });
});
