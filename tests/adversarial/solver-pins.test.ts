import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { at, block, goal, HOUR, member, preference, score, session } from "../engine/fixtures";
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

describe("pins that cannot all be kept", () => {
  const base: OptimizerInput = {
    sessions: [shifted("a", 0, 1), shifted("b", 0, 1), shifted("c", 2, 1)],
    goals: [goal("g1", "Ship faster", 1)],
    members: [member("m1", "Ada"), member("m2", "Bob")],
    scores: [score("a", "g1", 0.9), score("b", "g1", 0.5), score("c", "g1", 0.5)],
    preferences: [],
    blocks: [],
  };

  it("refuses the whole plan and names both pins when one teammate is pinned to two clashing sessions", () => {
    const input: OptimizerInput = {
      ...base,
      preferences: [preference("m1", "a", "pinned"), preference("m1", "b", "pinned")],
    };
    const outcome = optimizePlan(input);

    expect(outcome.kind).toBe("infeasible");

    if (outcome.kind === "infeasible") {
      expect(outcome.blockingPinnedSessionIds).toEqual(["a", "b"]);
      expect(outcome.conflicts.map((conflict) => conflict.kind)).toEqual(["pin_overlap"]);
    }

    expect(outcomeFailures(input, outcome)).toEqual([]);
  });

  it("names a pin that sits inside the teammate's own unavailable block", () => {
    const input: OptimizerInput = {
      ...base,
      preferences: [preference("m1", "a", "pinned")],
      blocks: [block("m1", 0, 1, "Customer call")],
    };
    const outcome = optimizePlan(input);

    expect(outcome.kind).toBe("infeasible");

    if (outcome.kind === "infeasible") {
      expect(outcome.blockingPinnedSessionIds).toEqual(["a"]);
      expect(outcome.conflicts.map((conflict) => conflict.kind)).toEqual(["blocked_time"]);
      expect(outcome.conflicts.at(0)?.detail).toContain("Customer call");
    }
  });

  it("names a pin against a teammate or a session that does not exist", () => {
    const ghostMember = optimizePlan({
      ...base,
      preferences: [preference("ghost", "a", "pinned")],
    });
    const ghostSession = optimizePlan({
      ...base,
      preferences: [preference("m1", "gone", "pinned")],
    });

    expect(ghostMember.kind).toBe("infeasible");
    expect(ghostSession.kind).toBe("infeasible");

    if (ghostMember.kind === "infeasible" && ghostSession.kind === "infeasible") {
      expect(ghostMember.conflicts.map((conflict) => conflict.kind)).toEqual(["unknown_member"]);
      expect(ghostSession.blockingPinnedSessionIds).toEqual(["gone"]);
    }
  });

  it("keeps two pins on clashing sessions when they belong to different teammates", () => {
    const input: OptimizerInput = {
      ...base,
      preferences: [preference("m1", "a", "pinned"), preference("m2", "b", "pinned")],
    };
    const outcome = optimizePlan(input);

    expect(outcomeFailures(input, outcome)).toEqual([]);
    expect(heldBy(assignmentsFor(outcome), "m1")).toContain("a");
    expect(heldBy(assignmentsFor(outcome), "m2")).toContain("b");
  });

  it("lets a pin override the same teammate's avoid without reporting the contradiction", () => {
    const input: OptimizerInput = {
      ...base,
      preferences: [preference("m1", "a", "pinned"), preference("m1", "a", "avoid")],
    };
    const outcome = optimizePlan(input);

    expect(outcome.kind).toBe("plan");
    expect(heldBy(assignmentsFor(outcome), "m1")).toContain("a");
  });
});
