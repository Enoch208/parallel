import { describe, expect, it } from "vitest";
import { canSolveExactly, objectiveUpperBound } from "../../convex/engine/bounds";
import { optimizePlanWithProof, repairPlanWithProof } from "../../convex/engine/exact";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { scoreAssignments } from "../../convex/engine/objective";
import { bruteForceCost, bruteForceOptimum } from "./brute-force-optimum";
import { outcomeFailures } from "./invariants";
import type { InstanceShape } from "./random-instances";
import { largeShape, randomInstance, smallShape } from "./random-instances";
import { canonicalScenario } from "./canonical-scenario";

const SMALL_COUNT = 300;
const REPAIR_COUNT = 120;
const LARGE_COUNT = 200;
const WIDE_COUNT = 40;
const TOLERANCE = 1e-9;

const wideShape: InstanceShape = {
  maxMembers: 3,
  maxWindows: 4,
  maxTracks: 3,
  maxGoals: 3,
  longSessionChance: 0.2,
  blockChance: 0.3,
  pinChance: 0.2,
  interestChance: 0.5,
  avoidChance: 0.2,
};

const BRUTE_FORCE_LIMIT = 60000;

const beamMissSeeds = [24, 105, 168, 175, 197, 201, 266, 282, 354, 378];

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

  it("matches the brute-force repair optimum, change penalty included", () => {
    const failures: string[] = [];
    let proven = 0;
    for (let seed = 1; seed <= REPAIR_COUNT; seed += 1) {
      const input = randomInstance(seed, smallShape);
      const base = optimizePlan(input);
      if (base.kind !== "plan") continue;
      const proof = repairPlanWithProof(input, base.assignments);
      if (proof.kind !== "plan" || proof.status !== "optimal") continue;
      proven += 1;
      const best = bruteForceOptimum(input, base.assignments);
      if (Math.abs(proof.objective.objective - best) > TOLERANCE) {
        failures.push(
          `seed ${String(seed)}: exact repair ${String(proof.objective.objective)} vs brute force ${String(best)}`,
        );
      }
      const heuristic = repairPlan(input, base.assignments);
      if (heuristic.kind === "plan" && heuristic.objective.objective > best + TOLERANCE) {
        failures.push(`seed ${String(seed)}: beam repair beat the repair optimum`);
      }
    }
    expect(failures).toEqual([]);
    expect(proven).toBeGreaterThan(REPAIR_COUNT / 2);
  });

  it("proves an optimum that beam search misses", () => {
    const failures: string[] = [];
    let checkedAgainstBruteForce = 0;
    for (const seed of beamMissSeeds) {
      const input = randomInstance(seed, wideShape);
      const proof = optimizePlanWithProof(input);
      const beam = optimizePlan(input);
      if (proof.kind !== "plan" || beam.kind !== "plan") {
        failures.push(`seed ${String(seed)}: expected a feasible plan`);
        continue;
      }
      if (proof.status !== "optimal") {
        failures.push(`seed ${String(seed)}: exact search did not prove optimality`);
        continue;
      }
      if (proof.objective.objective <= beam.objective.objective + TOLERANCE) {
        failures.push(`seed ${String(seed)}: exact search failed to beat beam search`);
      }
      if (bruteForceCost(input) > BRUTE_FORCE_LIMIT) continue;
      checkedAgainstBruteForce += 1;
      const best = bruteForceOptimum(input);
      if (Math.abs(proof.objective.objective - best) > TOLERANCE) {
        failures.push(
          `seed ${String(seed)}: exact ${String(proof.objective.objective)} vs brute force ${String(best)}`,
        );
      }
    }
    expect(failures).toEqual([]);
    expect(checkedAgainstBruteForce).toBe(8);
  });

  it("never lets beam search claim more than the proven optimum", () => {
    const failures: string[] = [];
    let compared = 0;
    for (let seed = 1; seed <= WIDE_COUNT; seed += 1) {
      const input = randomInstance(seed, wideShape);
      if (bruteForceCost(input) > BRUTE_FORCE_LIMIT) continue;
      const proof = optimizePlanWithProof(input);
      const beam = optimizePlan(input);
      if (proof.kind !== "plan" || beam.kind !== "plan" || proof.status !== "optimal") continue;
      compared += 1;
      const best = bruteForceOptimum(input);
      if (Math.abs(proof.objective.objective - best) > TOLERANCE) {
        failures.push(`seed ${String(seed)}: exact drifted from brute force`);
      }
      if (beam.objective.objective > proof.objective.objective + TOLERANCE) {
        failures.push(`seed ${String(seed)}: beam claimed more than the proven optimum`);
      }
    }
    expect(failures).toEqual([]);
    expect(compared).toBeGreaterThan(WIDE_COUNT / 2);
  });

  it("proves the canonical scenario optimal and improves on beam search", () => {
    const proof = optimizePlanWithProof(canonicalScenario);
    const beam = optimizePlan(canonicalScenario);
    if (proof.kind !== "plan" || beam.kind !== "plan") throw new Error("Expected a feasible plan");
    expect(proof.status).toBe("optimal");
    expect(proof.gap).toBeCloseTo(0, 9);
    expect(proof.nodesExplored).toBeGreaterThan(0);
    expect(proof.objective.objective).toBeGreaterThan(beam.objective.objective);
    expect(proof.upperBound).toBeCloseTo(proof.objective.objective, 9);
    expect(objectiveUpperBound(canonicalScenario)).toBeGreaterThan(proof.objective.objective);
    expect(scoreAssignments(canonicalScenario, proof.assignments).objective).toBeCloseTo(
      proof.objective.objective,
      9,
    );
  });

  it("reports a status honestly and keeps the gap non-negative", () => {
    const failures: string[] = [];
    let heuristicResults = 0;
    for (let seed = 1; seed <= LARGE_COUNT; seed += 1) {
      const input = randomInstance(seed, largeShape);
      const proof = optimizePlanWithProof(input);
      if (proof.kind !== "plan") continue;
      if (proof.status === "heuristic") heuristicResults += 1;
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
      if (proof.status === "optimal" && !canSolveExactly(input)) {
        failures.push(`seed ${String(seed)}: proved an instance the predicate rejected`);
      }
    }
    expect(failures).toEqual([]);
    expect(heuristicResults).toBeGreaterThan(0);
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
