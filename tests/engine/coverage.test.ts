import { describe, expect, it } from "vitest";
import { computeCoverageSummary } from "../../convex/engine/coverage";
import type { AssignmentSummary } from "../../convex/model/types";
import type { CoverageInput } from "../../convex/engine/types";
import { goal, member, score, session } from "./fixtures";

const oneGoal: CoverageInput = {
  sessions: [
    session("s1", "First strong session", 0, 1, "Main"),
    session("s2", "Second strong session", 1, 1, "Main"),
  ],
  goals: [goal("g1", "Only goal", 3)],
  members: [member("m1", "Ada")],
  scores: [score("s1", "g1", 0.8), score("s2", "g1", 0.8)],
};

function attend(sessionIds: readonly string[]): AssignmentSummary[] {
  return sessionIds.map((sessionId) => ({
    sessionId,
    membershipId: "m1",
    pinned: false,
    reason: "fixture",
  }));
}

describe("coverage math", () => {
  it("scores an empty assignment set at zero", () => {
    const summary = computeCoverageSummary(oneGoal, []);
    expect(summary.teamGoalCoverage).toBe(0);
    expect(summary.uniqueSessions).toBe(0);
    expect(summary.duplicateAttendances).toBe(0);
    expect(summary.maxAttendableSessions).toBe(2);
    expect(summary.perGoal.map((entry) => entry.coverage)).toEqual([0]);
  });

  it("applies the 0.75 absorption to a single session", () => {
    const summary = computeCoverageSummary(oneGoal, attend(["s1"]));
    expect(summary.teamGoalCoverage).toBeCloseTo(60, 10);
  });

  it("diminishes the return of a second strong session on the same goal", () => {
    const first = computeCoverageSummary(oneGoal, attend(["s1"]));
    const both = computeCoverageSummary(oneGoal, attend(["s1", "s2"]));
    const firstLift = first.teamGoalCoverage;
    const secondLift = both.teamGoalCoverage - first.teamGoalCoverage;
    expect(both.teamGoalCoverage).toBeCloseTo(84, 10);
    expect(secondLift).toBeGreaterThan(0);
    expect(secondLift).toBeLessThan(firstLift);
  });

  it("weights goals against each other", () => {
    const weighted: CoverageInput = {
      sessions: [
        session("sHigh", "Covers the heavy goal", 0, 1, "Main"),
        session("sLow", "Covers the light goal", 1, 1, "Main"),
      ],
      goals: [goal("gHigh", "Heavy", 5), goal("gLow", "Light", 1)],
      members: [member("m1", "Ada")],
      scores: [score("sHigh", "gHigh", 0.8), score("sLow", "gLow", 0.8)],
    };
    const heavy = computeCoverageSummary(weighted, attend(["sHigh"]));
    const light = computeCoverageSummary(weighted, attend(["sLow"]));
    expect(heavy.teamGoalCoverage).toBeCloseTo(50, 10);
    expect(light.teamGoalCoverage).toBeCloseTo(10, 10);
    expect(heavy.teamGoalCoverage).toBeGreaterThan(light.teamGoalCoverage);
  });

  it("counts duplicate attendances and unique sessions separately", () => {
    const shared: CoverageInput = {
      ...oneGoal,
      members: [member("m1", "Ada"), member("m2", "Brian")],
    };
    const summary = computeCoverageSummary(shared, [
      { sessionId: "s1", membershipId: "m1", pinned: false, reason: "fixture" },
      { sessionId: "s1", membershipId: "m2", pinned: false, reason: "fixture" },
      { sessionId: "s2", membershipId: "m1", pinned: false, reason: "fixture" },
    ]);
    expect(summary.uniqueSessions).toBe(2);
    expect(summary.duplicateAttendances).toBe(1);
    expect(summary.maxAttendableSessions).toBe(2);
  });
});
