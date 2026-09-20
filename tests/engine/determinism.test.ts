import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import type { OptimizerInput } from "../../convex/engine/types";
import { canonicalScenario } from "./canonical-scenario";

function reversedInput(input: OptimizerInput): OptimizerInput {
  return {
    sessions: [...input.sessions].reverse(),
    goals: [...input.goals].reverse(),
    members: [...input.members].reverse(),
    scores: [...input.scores].reverse(),
    preferences: [...input.preferences].reverse(),
    blocks: [...input.blocks].reverse(),
  };
}

describe("determinism", () => {
  it("produces an identical plan when run twice on the same input", () => {
    expect(optimizePlan(canonicalScenario)).toEqual(optimizePlan(canonicalScenario));
  });

  it("does not depend on the order the input arrays arrive in", () => {
    expect(optimizePlan(reversedInput(canonicalScenario))).toEqual(optimizePlan(canonicalScenario));
  });
});
