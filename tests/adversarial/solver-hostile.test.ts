import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { at, block, goal, HOUR, member, score, session } from "../engine/fixtures";
import { outcomeFailures } from "../engine/invariants";

function shifted(id: string, startHour: number, durationHours: number): SessionSummary {
  const built = session(id, `Session ${id}`, 0, 1, "T");
  return {
    ...built,
    startsAt: at(0) + startHour * HOUR,
    endsAt: at(0) + (startHour + durationHours) * HOUR,
  };
}

function assignmentsFor(outcome: ReturnType<typeof optimizePlan>): readonly AssignmentSummary[] {
  if (outcome.kind !== "plan") {
    throw new Error(`expected a plan, got ${outcome.kind}`);
  }

  return outcome.assignments;
}

function heldBy(assignments: readonly AssignmentSummary[], membershipId: string): string[] {
  return assignments
    .filter((assignment) => assignment.membershipId === membershipId)
    .map((assignment) => assignment.sessionId)
    .sort();
}

describe("an agenda where everything overlaps", () => {
  const input: OptimizerInput = {
    sessions: [shifted("a", 0, 3), shifted("b", 0.5, 3), shifted("c", 1, 3)],
    goals: [goal("g1", "Ship faster", 3), goal("g2", "Cut spend", 1)],
    members: [member("m1", "Ada"), member("m2", "Bob"), member("m3", "Cai"), member("m4", "Dee")],
    scores: [
      score("a", "g1", 0.9),
      score("b", "g1", 0.8),
      score("c", "g2", 0.7),
      score("a", "g2", 0.2),
    ],
    preferences: [],
    blocks: [],
  };

  it("gives nobody two places at once even though no two sessions share a start time", () => {
    const outcome = optimizePlan(input);

    expect(outcomeFailures(input, outcome)).toEqual([]);

    for (const teammate of input.members) {
      expect(heldBy(assignmentsFor(outcome), teammate.id).length).toBeLessThanOrEqual(1);
    }
  });

  it("leaves the fourth teammate free rather than paying a duplicate penalty for nothing", () => {
    const outcome = optimizePlan(input);
    const assignments = assignmentsFor(outcome);

    expect(assignments).toHaveLength(3);
    expect(new Set(assignments.map((assignment) => assignment.sessionId)).size).toBe(3);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.duplicateAttendances).toBe(0);
      expect(outcome.coverage.uniqueSessions).toBe(3);
    }
  });

  it("keeps sessions one teammate cannot physically reach out of the coverage denominator", () => {
    const single: OptimizerInput = {
      ...input,
      members: [member("m1", "Ada")],
    };
    const outcome = optimizePlan(single);

    expect(assignmentsFor(outcome)).toHaveLength(1);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.uniqueSessions).toBe(1);
      expect(outcome.coverage.maxAttendableSessions).toBe(1);
    }
  });
});

describe("a teammate who is unavailable all day", () => {
  const input: OptimizerInput = {
    sessions: [shifted("a", 0, 1), shifted("b", 2, 1), shifted("c", 4, 1)],
    goals: [goal("g1", "Ship faster", 1)],
    members: [member("m1", "Ada"), member("m2", "Bob")],
    scores: [score("a", "g1", 0.9), score("b", "g1", 0.6), score("c", "g1", 0.4)],
    preferences: [],
    blocks: [block("m1", -1, 26, "Travelling")],
  };

  it("plans around them instead of failing, and never books them", () => {
    const outcome = optimizePlan(input);

    expect(outcomeFailures(input, outcome)).toEqual([]);
    expect(heldBy(assignmentsFor(outcome), "m1")).toEqual([]);
    expect(heldBy(assignmentsFor(outcome), "m2")).toEqual(["a", "b", "c"]);
  });

  it("produces an empty plan, not a crash, when the whole team is blocked out", () => {
    const everyoneOut: OptimizerInput = {
      ...input,
      blocks: [block("m1", -1, 26, "Travelling"), block("m2", -1, 26, "Travelling")],
    };
    const outcome = optimizePlan(everyoneOut);

    expect(outcomeFailures(everyoneOut, outcome)).toEqual([]);
    expect(assignmentsFor(outcome)).toEqual([]);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.teamGoalCoverage).toBe(0);
      expect(outcome.coverage.perGoal.map((entry) => entry.coverage)).toEqual([0]);
    }
  });
});
