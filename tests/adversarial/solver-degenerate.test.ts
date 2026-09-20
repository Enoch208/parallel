import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { at, goal, HOUR, member, score, session } from "../engine/fixtures";
import { outcomeFailures } from "../engine/invariants";

function assignmentsFor(outcome: ReturnType<typeof optimizePlan>): readonly AssignmentSummary[] {
  if (outcome.kind !== "plan") {
    throw new Error(`expected a plan, got ${outcome.kind}`);
  }

  return outcome.assignments;
}

function shifted(id: string, startHour: number, durationHours: number): SessionSummary {
  const built = session(id, `Session ${id}`, 0, 1, "T");
  return {
    ...built,
    startsAt: at(0) + startHour * HOUR,
    endsAt: at(0) + (startHour + durationHours) * HOUR,
  };
}

describe("degenerate relevance", () => {
  const shell: OptimizerInput = {
    sessions: [shifted("a", 0, 1), shifted("b", 0, 1), shifted("c", 2, 1)],
    goals: [goal("g1", "Ship faster", 2), goal("g2", "Cut spend", 1)],
    members: [member("m1", "Ada"), member("m2", "Bob")],
    scores: [],
    preferences: [],
    blocks: [],
  };

  function flat(relevance: number): OptimizerInput {
    return {
      ...shell,
      scores: shell.sessions.flatMap((entry) =>
        shell.goals.map((target) => score(entry.id, target.id, relevance)),
      ),
    };
  }

  it("reports zero coverage and never pays a duplicate penalty when nothing is relevant", () => {
    const input = flat(0);
    const outcome = optimizePlan(input);

    expect(outcomeFailures(input, outcome)).toEqual([]);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.teamGoalCoverage).toBe(0);
      expect(outcome.coverage.duplicateAttendances).toBe(0);
      expect(outcome.objective.objective).toBe(0);
    }
  });

  it("spreads the team when everything is equally relevant instead of stacking one session", () => {
    const input = flat(1);
    const outcome = optimizePlan(input);
    const assignments = assignmentsFor(outcome);

    expect(outcomeFailures(input, outcome)).toEqual([]);
    expect(new Set(assignments.map((assignment) => assignment.sessionId)).size).toBe(3);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.duplicateAttendances).toBe(0);
      expect(outcome.coverage.teamGoalCoverage).toBeGreaterThan(98);
      expect(outcome.coverage.teamGoalCoverage).toBeLessThanOrEqual(100);
    }
  });

  it("clamps a relevance the scorer put outside zero to one rather than trusting it", () => {
    const wild: OptimizerInput = {
      ...shell,
      scores: [
        score("a", "g1", 4),
        score("b", "g1", -3),
        score("c", "g2", Number.NaN),
        score("a", "g2", Number.POSITIVE_INFINITY),
      ],
    };
    const outcome = optimizePlan(wild);

    expect(outcomeFailures(wild, outcome)).toEqual([]);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.teamGoalCoverage).toBeGreaterThanOrEqual(0);
      expect(outcome.coverage.teamGoalCoverage).toBeLessThanOrEqual(100);

      for (const entry of outcome.coverage.perGoal) {
        expect(Number.isFinite(entry.coverage)).toBe(true);
      }
    }
  });

  it("reports zero rather than dividing by zero when every goal carries no weight", () => {
    const weightless: OptimizerInput = {
      ...flat(1),
      goals: [goal("g1", "Ship faster", 0), goal("g2", "Cut spend", 0)],
    };
    const outcome = optimizePlan(weightless);

    expect(outcomeFailures(weightless, outcome)).toEqual([]);

    if (outcome.kind === "plan") {
      expect(outcome.coverage.teamGoalCoverage).toBe(0);
    }
  });
});
