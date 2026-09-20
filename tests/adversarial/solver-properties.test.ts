import { describe, expect, it } from "vitest";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { computeCoverageSummary } from "../../convex/engine/coverage";
import { countMovedAssignments } from "../../convex/engine/planDiff";
import type { OptimizerInput } from "../../convex/engine/types";
import { outcomeFailures } from "../engine/invariants";
import {
  largeShape,
  mediumShape,
  randomInstance,
  smallShape,
  withExtraBlock,
} from "../engine/random-instances";

describe("seeded adversarial instances", () => {
  const shapes = [smallShape, mediumShape, largeShape];

  it("holds every hard constraint across two hundred generated instances", () => {
    const failures: string[] = [];

    for (let seed = 1; seed <= 200; seed += 1) {
      const shape = shapes[seed % shapes.length];

      if (shape === undefined) {
        continue;
      }

      const input = randomInstance(seed, shape);
      const found = outcomeFailures(input, optimizePlan(input));

      if (found.length > 0) {
        failures.push(`seed ${String(seed)}: ${found.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("returns the same plan whatever order the rows arrive in", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const reversed: OptimizerInput = {
        sessions: [...input.sessions].reverse(),
        goals: [...input.goals].reverse(),
        members: [...input.members].reverse(),
        scores: [...input.scores].reverse(),
        preferences: [...input.preferences].reverse(),
        blocks: [...input.blocks].reverse(),
      };

      expect(optimizePlan(reversed)).toEqual(optimizePlan(input));
    }
  });

  it("recomputes the same coverage the plan reported, for every generated instance", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const input = randomInstance(seed, largeShape);
      const outcome = optimizePlan(input);

      if (outcome.kind !== "plan") {
        continue;
      }

      expect(computeCoverageSummary(input, outcome.assignments)).toEqual(outcome.coverage);
      expect(outcome.coverage.uniqueSessions).toBeLessThanOrEqual(
        outcome.coverage.maxAttendableSessions,
      );
    }
  });

  it("moves nobody when a plan is repaired against unchanged constraints", () => {
    let repairsSeen = 0;

    for (let seed = 1; seed <= 60; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const first = optimizePlan(input);

      if (first.kind !== "plan") {
        continue;
      }

      const repaired = repairPlan(input, first.assignments);

      expect(outcomeFailures(input, repaired)).toEqual([]);

      if (repaired.kind === "plan") {
        expect(repaired.objective.changePenalty).toBe(0);
        expect(repaired.assignments).toEqual(first.assignments);
        repairsSeen += 1;
      }
    }

    expect(repairsSeen).toBeGreaterThan(30);
  });

  it("never reshuffles more teammates than a fresh optimize after a new block lands", () => {
    let perturbationsSeen = 0;

    for (let seed = 1; seed <= 60; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const before = optimizePlan(input);

      if (before.kind !== "plan") {
        continue;
      }

      const changed = withExtraBlock(input, seed);
      const fresh = optimizePlan(changed);
      const repaired = repairPlan(changed, before.assignments);

      expect(outcomeFailures(changed, repaired)).toEqual([]);

      if (fresh.kind !== "plan" || repaired.kind !== "plan") {
        continue;
      }

      const movedByFresh = countMovedAssignments(
        changed.sessions,
        before.assignments,
        fresh.assignments,
      );
      const movedByRepair = countMovedAssignments(
        changed.sessions,
        before.assignments,
        repaired.assignments,
      );

      expect(movedByRepair).toBeLessThanOrEqual(movedByFresh);
      perturbationsSeen += 1;
    }

    expect(perturbationsSeen).toBeGreaterThan(30);
  });

  it("keeps a stale assignment against a session that has since vanished out of the repaired plan", () => {
    const input = randomInstance(3, mediumShape);
    const outcome = repairPlan(input, [
      { sessionId: "not-in-this-agenda", membershipId: "m0", pinned: false, reason: "stale" },
    ]);

    expect(outcomeFailures(input, outcome)).toEqual([]);

    if (outcome.kind === "plan") {
      expect(
        outcome.assignments.some((assignment) => assignment.sessionId === "not-in-this-agenda"),
      ).toBe(false);
    }
  });
});
