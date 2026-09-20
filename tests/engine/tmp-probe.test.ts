import { describe, expect, it } from "vitest";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { optimizePlanWithProof, repairPlanWithProof } from "../../convex/engine/exact";
import { bruteForceOptimum } from "./brute-force-optimum";
import { randomInstance, withExtraBlock } from "./random-instances";
import type { InstanceShape } from "./random-instances";

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

describe("probe", () => {
  it("counts beam suboptimality", () => {
    const counts = { plain: 0, repair: 0, checked: 0, exactBeatsBeam: 0, notOptimal: 0 };
    const examples: string[] = [];
    for (let seed = 1; seed <= 400; seed += 1) {
      const input = randomInstance(seed, wideShape);
      const beam = optimizePlan(input);
      if (beam.kind !== "plan") continue;
      counts.checked += 1;
      const best = bruteForceOptimum(input);
      if (beam.objective.objective < best - 1e-9) {
        counts.plain += 1;
        examples.push(`plain seed ${String(seed)}`);
      }
      const proof = optimizePlanWithProof(input);
      if (proof.kind === "plan" && proof.status !== "optimal") counts.notOptimal += 1;
      if (proof.kind === "plan" && proof.objective.objective > beam.objective.objective + 1e-9) {
        counts.exactBeatsBeam += 1;
      }
      const changed = withExtraBlock(input, seed);
      const repaired = repairPlan(changed, beam.assignments);
      const repairProof = repairPlanWithProof(changed, beam.assignments);
      if (repaired.kind !== "plan" || repairProof.kind !== "plan") continue;
      const repairBest = bruteForceOptimum(changed, beam.assignments);
      if (repaired.objective.objective < repairBest - 1e-9) {
        counts.repair += 1;
        examples.push(`repair seed ${String(seed)}`);
      }
      if (Math.abs(repairProof.objective.objective - repairBest) > 1e-9) {
        examples.push(
          `repair proof seed ${String(seed)} ${String(repairProof.objective.objective)} vs ${String(repairBest)} status ${repairProof.status}`,
        );
      }
    }
    expect({ counts, examples: examples.slice(0, 12) }).toEqual({});
  });
});
