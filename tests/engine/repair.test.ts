import { describe, expect, it } from "vitest";
import { optimizePlan, repairPlan } from "../../convex/engine/optimize";
import { countMovedAssignments } from "../../convex/engine/planDiff";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary } from "../../convex/model/types";
import { block, goal, member, score, session } from "./fixtures";

const trackLabels = ["Alpha", "Beta", "Gamma"];
const windowStarts = [0, 2, 4];

const interchangeableSessions = windowStarts.flatMap((startHour, windowIndex) =>
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
  sessions: interchangeableSessions,
  goals: [goal("g1", "One shared goal", 3)],
  members: [member("m1", "Ada"), member("m2", "Brian"), member("m3", "Cleo")],
  scores: interchangeableSessions.map((entry) => score(entry.id, "g1", 0.5)),
  preferences: [],
  blocks: [],
};

function planAssignments(input: OptimizerInput): AssignmentSummary[] {
  const outcome = optimizePlan(input);
  if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
  return [...outcome.assignments];
}

describe("repair mode", () => {
  it("moves strictly fewer teammates than a full re-optimization after a new block", () => {
    const current = planAssignments(baseInput);
    const afterChange: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 0, 1, "Customer escalation")],
    };
    const reoptimized = optimizePlan(afterChange);
    const repaired = repairPlan(afterChange, current);
    if (reoptimized.kind !== "plan" || repaired.kind !== "plan") {
      throw new Error("Expected feasible plans");
    }
    const movedByReoptimize = countMovedAssignments(
      baseInput.sessions,
      current,
      reoptimized.assignments,
    );
    const movedByRepair = countMovedAssignments(baseInput.sessions, current, repaired.assignments);
    expect(movedByRepair).toBeGreaterThan(0);
    expect(movedByRepair).toBeLessThan(movedByReoptimize);
    expect(repaired.coverage.teamGoalCoverage).toBeCloseTo(
      reoptimized.coverage.teamGoalCoverage,
      9,
    );
    expect(repaired.coverage.duplicateAttendances).toBe(0);
  });

  it("charges the change penalty it actually applied", () => {
    const current = planAssignments(baseInput);
    const afterChange: OptimizerInput = {
      ...baseInput,
      blocks: [block("m1", 0, 1, "Customer escalation")],
    };
    const repaired = repairPlan(afterChange, current);
    if (repaired.kind !== "plan") throw new Error("Expected a feasible plan");
    expect(repaired.objective.changePenalty).toBeGreaterThan(0);
  });

  it("still refuses to break a pin while repairing", () => {
    const current = planAssignments(baseInput);
    const afterChange: OptimizerInput = {
      ...baseInput,
      preferences: [{ membershipId: "m1", sessionId: "w0-t0", stance: "pinned" }],
      blocks: [block("m1", 0, 1, "Customer escalation")],
    };
    const repaired = repairPlan(afterChange, current);
    expect(repaired.kind).toBe("infeasible");
    if (repaired.kind !== "infeasible") throw new Error("Expected infeasible");
    expect(repaired.blockingPinnedSessionIds).toEqual(["w0-t0"]);
  });
});
