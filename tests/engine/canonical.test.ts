import { describe, expect, it } from "vitest";
import { computeCoverageSummary } from "../../convex/engine/coverage";
import { optimizePlan } from "../../convex/engine/optimize";
import type { CoverageSummary } from "../../convex/model/types";
import { canonicalScenario, everyoneChasesTheFamousSessions } from "./canonical-scenario";

function headline(summary: CoverageSummary, assignedSeats: number): Record<string, number> {
  return {
    teamGoalCoverage: Number(summary.teamGoalCoverage.toFixed(2)),
    uniqueSessions: summary.uniqueSessions,
    duplicateAttendances: summary.duplicateAttendances,
    maxAttendableSessions: summary.maxAttendableSessions,
    assignedSeats,
  };
}

const naturalPlan = everyoneChasesTheFamousSessions(canonicalScenario);
const naturalSummary = computeCoverageSummary(canonicalScenario, naturalPlan);
const outcome = optimizePlan(canonicalScenario);

describe("canonical scenario", () => {
  it("stays feasible", () => {
    expect(outcome.kind).toBe("plan");
  });

  it("matches the locked before and after figures", () => {
    if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
    expect({
      before: headline(naturalSummary, naturalPlan.length),
      after: headline(outcome.coverage, outcome.assignments.length),
      perGoalAfter: outcome.coverage.perGoal.map((entry) => ({
        goalId: entry.goalId,
        weight: entry.weight,
        coverage: Number(entry.coverage.toFixed(4)),
      })),
    }).toMatchSnapshot();
  });

  it("beats the plan the team would have made on its own", () => {
    if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
    expect(outcome.coverage.teamGoalCoverage).toBeGreaterThan(naturalSummary.teamGoalCoverage);
    expect(outcome.coverage.uniqueSessions).toBeGreaterThan(naturalSummary.uniqueSessions);
    expect(outcome.coverage.duplicateAttendances).toBeLessThan(naturalSummary.duplicateAttendances);
  });
});
