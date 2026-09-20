import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import { overlaps } from "../../convex/engine/intervals";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { block, goal, member, preference, score, session } from "./fixtures";

const goals = [goal("g1", "Everything", 5)];

function planOf(input: OptimizerInput): {
  assignments: readonly AssignmentSummary[];
} {
  const outcome = optimizePlan(input);
  if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
  return outcome;
}

function sessionsFor(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
  membershipId: string,
): SessionSummary[] {
  return assignments
    .filter((assignment) => assignment.membershipId === membershipId)
    .map((assignment) => {
      const found = input.sessions.find((entry) => entry.id === assignment.sessionId);
      if (found === undefined) throw new Error(`Unknown session ${assignment.sessionId}`);
      return found;
    });
}

const overlappingAgenda: OptimizerInput = {
  sessions: [
    session("long", "A long workshop", 0, 2, "Workshop"),
    session("short", "A short talk inside it", 1, 0.5, "Main"),
    session("later", "A talk after both", 3, 1, "Main"),
  ],
  goals,
  members: [member("m1", "Ada")],
  scores: [score("long", "g1", 0.9), score("short", "g1", 0.9), score("later", "g1", 0.9)],
  preferences: [],
  blocks: [],
};

describe("hard constraints", () => {
  it("never assigns one teammate two overlapping sessions", () => {
    const { assignments } = planOf(overlappingAgenda);
    const mine = sessionsFor(overlappingAgenda, assignments, "m1");
    for (let left = 0; left < mine.length; left += 1) {
      for (let right = left + 1; right < mine.length; right += 1) {
        const first = mine[left];
        const second = mine[right];
        if (first === undefined || second === undefined) throw new Error("missing session");
        expect(overlaps(first, second)).toBe(false);
      }
    }
    expect(mine.length).toBe(2);
  });

  it("never assigns a session overlapping an availability block", () => {
    const input: OptimizerInput = {
      ...overlappingAgenda,
      blocks: [block("m1", 0, 2.5, "Customer call")],
    };
    const { assignments } = planOf(input);
    expect(assignments.map((assignment) => assignment.sessionId)).toEqual(["later"]);
  });

  it("always honours a pin even when a better session sits in the same window", () => {
    const input: OptimizerInput = {
      sessions: [
        session("weak", "Low relevance but pinned", 0, 1, "Side"),
        session("strong", "High relevance", 0, 1, "Main"),
      ],
      goals,
      members: [member("m1", "Ada")],
      scores: [score("weak", "g1", 0.05), score("strong", "g1", 0.95)],
      preferences: [preference("m1", "weak", "pinned")],
      blocks: [],
    };
    const { assignments } = planOf(input);
    expect(assignments).toEqual([
      {
        sessionId: "weak",
        membershipId: "m1",
        pinned: true,
        reason: "Pinned by the team, kept in every plan",
      },
    ]);
  });

  it("returns infeasible naming both pins when two pins overlap", () => {
    const input: OptimizerInput = {
      sessions: [
        session("pinA", "Pinned A", 0, 1, "Main"),
        session("pinB", "Pinned B", 0.5, 1, "Side"),
      ],
      goals,
      members: [member("m1", "Ada")],
      scores: [score("pinA", "g1", 0.5), score("pinB", "g1", 0.5)],
      preferences: [preference("m1", "pinA", "pinned"), preference("m1", "pinB", "pinned")],
      blocks: [],
    };
    const outcome = optimizePlan(input);
    expect(outcome.kind).toBe("infeasible");
    if (outcome.kind !== "infeasible") throw new Error("Expected infeasible");
    expect(outcome.blockingPinnedSessionIds).toEqual(["pinA", "pinB"]);
    expect(outcome.conflicts.map((conflict) => conflict.kind)).toEqual(["pin_overlap"]);
  });

  it("returns infeasible naming the pin that sits inside a block", () => {
    const input: OptimizerInput = {
      sessions: [session("pinA", "Pinned A", 0, 1, "Main")],
      goals,
      members: [member("m1", "Ada")],
      scores: [score("pinA", "g1", 0.5)],
      preferences: [preference("m1", "pinA", "pinned")],
      blocks: [block("m1", 0.25, 0.5, "Flight home")],
    };
    const outcome = optimizePlan(input);
    if (outcome.kind !== "infeasible") throw new Error("Expected infeasible");
    expect(outcome.blockingPinnedSessionIds).toEqual(["pinA"]);
    expect(outcome.conflicts[0]?.kind).toBe("blocked_time");
    expect(outcome.conflicts[0]?.detail).toContain("Flight home");
  });
});
