import { describe, expect, it } from "vitest";
import { objectiveUpperBound } from "../../convex/engine/bounds";
import { canSolveExactly, optimizePlanWithProof } from "../../convex/engine/exact";
import { optimizePlan } from "../../convex/engine/optimize";
import { scoreAssignments } from "../../convex/engine/objective";
import { bruteForceOptimum } from "./brute-force-optimum";
import { outcomeFailures } from "./invariants";
import { largeShape, randomInstance, smallShape } from "./random-instances";

const SMALL_COUNT = 300;
const LARGE_COUNT = 200;
const TOLERANCE = 1e-9;

describe("exact solver against brute force", () => {
  it("matches the brute-force optimum on small instances", () => {
    const failures: string[] = [];
    let proven = 0;
    for (let seed = 1; seed <= SMALL_COUNT; seed += 1) {
      const input = randomInstance(seed, smallShape);
      const proof = optimizePlanWithProof(input);
      for (const failure of outcomeFailures(input, proof)) {
        failures.push(`seed ${String(seed)}: ${failure}`);
      }
      if (proof.kind !== "plan") continue;
      if (proof.status !== "optimal") {
        failures.push(`seed ${String(seed)}: exact search did not finish on a small instance`);
        continue;
      }
      proven += 1;
      const best = bruteForceOptimum(input);
      if (Math.abs(proof.objective.objective - best) > TOLERANCE) {
        failures.push(
          `seed ${String(seed)}: exact ${String(proof.objective.objective)} vs brute force ${String(best)}`,
        );
      }
      const rescored = scoreAssignments(input, proof.assignments).objective;
      if (Math.abs(rescored - proof.objective.objective) > TOLERANCE) {
        failures.push(`seed ${String(seed)}: exact plan rescores to ${String(rescored)}`);
      }
    }
    expect(failures).toEqual([]);
    expect(proven).toBeGreaterThan(SMALL_COUNT / 2);
  });

  it("never lets beam search beat the proven optimum", () => {
    const failures: string[] = [];
    let beamBelowOptimum = 0;
    for (let seed = 1; seed <= SMALL_COUNT; seed += 1) {
      const input = randomInstance(seed, smallShape);
      const proof = optimizePlanWithProof(input);
      const beam = optimizePlan(input);
      if (proof.kind !== "plan" || beam.kind !== "plan" || proof.status !== "optimal") continue;
      const difference = beam.objective.objective - proof.objective.objective;
      if (difference > TOLERANCE) {
        failures.push(`seed ${String(seed)}: beam exceeded the optimum by ${String(difference)}`);
      }
      if (difference < -TOLERANCE) beamBelowOptimum += 1;
    }
    expect(failures).toEqual([]);
    expect(beamBelowOptimum).toBe(0);
  });

  it("reports a status honestly and keeps the gap non-negative", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= LARGE_COUNT; seed += 1) {
      const input = randomInstance(seed, largeShape);
      const proof = optimizePlanWithProof(input);
      if (proof.kind !== "plan") continue;
      if (proof.gap < -TOLERANCE) {
        failures.push(`seed ${String(seed)}: negative gap ${String(proof.gap)}`);
      }
      if (proof.upperBound < proof.objective.objective - TOLERANCE) {
        failures.push(`seed ${String(seed)}: upper bound below the achieved objective`);
      }
      if (proof.status === "optimal" && Math.abs(proof.gap) > TOLERANCE) {
        failures.push(`seed ${String(seed)}: optimal result reported a gap`);
      }
      if (proof.status === "heuristic" && proof.nodesExplored === 0 && canSolveExactly(input)) {
        failures.push(`seed ${String(seed)}: skipped exact mode it claimed to support`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("bounds the objective from above on every generated instance", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= LARGE_COUNT; seed += 1) {
      const input = randomInstance(seed, largeShape);
      const outcome = optimizePlan(input);
      if (outcome.kind !== "plan") continue;
      const bound = objectiveUpperBound(input);
      if (outcome.objective.objective > bound + TOLERANCE) {
        failures.push(
          `seed ${String(seed)}: ${String(outcome.objective.objective)} > ${String(bound)}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
