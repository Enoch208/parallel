import { describe, expect, it } from "vitest";
import { buildTripSummary } from "../../convex/model/briefSchema";
import type { CoverageSummary, GoalCoverage } from "../../convex/model/types";

function coverage(
  teamGoalCoverage: number,
  uniqueSessions: number,
  duplicateAttendances: number,
  perGoal: readonly GoalCoverage[],
): CoverageSummary {
  return {
    teamGoalCoverage,
    perGoal,
    uniqueSessions,
    maxAttendableSessions: 9,
    duplicateAttendances,
  };
}

const goals: GoalCoverage[] = [
  { goalId: "g1", label: "Automate revenue cycle", weight: 4, coverage: 0.9 },
  { goalId: "g2", label: "Track policy", weight: 3, coverage: 0.73 },
  { goalId: "g3", label: "Scout partners", weight: 2, coverage: 0.93 },
  { goalId: "g4", label: "Cut documentation burden", weight: 5, coverage: 0 },
];

describe("trip summary arithmetic", () => {
  it("computes every figure from the supplied facts", () => {
    const summary = buildTripSummary({
      eventName: "ViVE 2026",
      attendees: 5,
      tripCostEstimate: 18000,
      sessionsAvailable: 9,
      before: coverage(41.25, 3, 2, goals),
      after: coverage(88.2633297781808, 8, 1, goals),
      noteSessionIds: ["s1", "s2", "s2", "s3"],
    });

    expect(summary.eventName).toBe("ViVE 2026");
    expect(summary.attendees).toBe(5);
    expect(summary.sessionsAvailable).toBe(9);
    expect(summary.sessionsUniquelyCovered).toBe(8);
    expect(summary.duplicateAttendances).toBe(1);
    expect(summary.coverageBefore).toBe(41.3);
    expect(summary.coverageAfter).toBe(88.3);
    expect(summary.coverageGain).toBe(47);
    expect(summary.goalsTotal).toBe(4);
    expect(summary.goalsRepresented).toBe(3);
    expect(summary.takeawaysCaptured).toBe(4);
    expect(summary.sessionsWithTakeaways).toBe(3);
    expect(summary.tripCostEstimate).toBe(18000);
    expect(summary.costPerSessionCovered).toBe(2250);
    expect(summary.tripCostEstimateLabel).toContain("team lead");
  });

  it("leaves the cost figures null when the lead entered no estimate", () => {
    const summary = buildTripSummary({
      eventName: "ViVE 2026",
      attendees: 5,
      tripCostEstimate: null,
      sessionsAvailable: 9,
      before: coverage(0, 0, 0, goals),
      after: coverage(88.26, 8, 0, goals),
      noteSessionIds: [],
    });

    expect(summary.tripCostEstimate).toBeNull();
    expect(summary.costPerSessionCovered).toBeNull();
    expect(summary.takeawaysCaptured).toBe(0);
    expect(summary.sessionsWithTakeaways).toBe(0);
    expect(summary.coverageBefore).toBe(0);
    expect(summary.coverageGain).toBe(88.3);
  });

  it("leaves cost per session null when nothing was covered", () => {
    const summary = buildTripSummary({
      eventName: "ViVE 2026",
      attendees: 5,
      tripCostEstimate: 18000,
      sessionsAvailable: 9,
      before: coverage(0, 0, 0, goals),
      after: coverage(0, 0, 0, goals),
      noteSessionIds: [],
    });

    expect(summary.costPerSessionCovered).toBeNull();
    expect(summary.sessionsUniquelyCovered).toBe(0);
  });
});
