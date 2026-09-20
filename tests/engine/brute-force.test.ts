import { describe, expect, it } from "vitest";
import { optimizePlan } from "../../convex/engine/optimize";
import { scoreAssignments } from "../../convex/engine/objective";
import { overlaps, sortedSessions } from "../../convex/engine/intervals";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import { block, goal, member, preference, score, session } from "./fixtures";

const TOLERANCE = 1e-9;

function windowsOf(sessions: readonly SessionSummary[]): SessionSummary[][] {
  const byStart = new Map<number, SessionSummary[]>();
  for (const entry of sortedSessions(sessions)) {
    const existing = byStart.get(entry.startsAt);
    if (existing === undefined) byStart.set(entry.startsAt, [entry]);
    else existing.push(entry);
  }
  return [...byStart.entries()].sort((left, right) => left[0] - right[0]).map((entry) => entry[1]);
}

function forbidden(input: OptimizerInput, membershipId: string, entry: SessionSummary): boolean {
  const blocked = input.blocks.some(
    (candidate) => candidate.membershipId === membershipId && overlaps(candidate, entry),
  );
  const avoided = input.preferences.some(
    (candidate) =>
      candidate.membershipId === membershipId &&
      candidate.sessionId === entry.id &&
      candidate.stance === "avoid",
  );
  return blocked || avoided;
}

function schedulesFor(input: OptimizerInput, membershipId: string): SessionSummary[][] {
  const windows = windowsOf(input.sessions);
  let schedules: SessionSummary[][] = [[]];
  for (const windowSessions of windows) {
    const next: SessionSummary[][] = [];
    for (const schedule of schedules) {
      next.push(schedule);
      for (const entry of windowSessions) {
        if (forbidden(input, membershipId, entry)) continue;
        if (schedule.some((taken) => overlaps(taken, entry))) continue;
        next.push([...schedule, entry]);
      }
    }
    schedules = next;
  }
  return schedules;
}

function bestObjectiveByBruteForce(input: OptimizerInput): number {
  const perMember = input.members.map((teammate) => ({
    membershipId: teammate.id,
    schedules: schedulesFor(input, teammate.id),
  }));
  let best = Number.NEGATIVE_INFINITY;
  const walk = (index: number, assignments: AssignmentSummary[]): void => {
    const entry = perMember[index];
    if (entry === undefined) {
      best = Math.max(best, scoreAssignments(input, assignments).objective);
      return;
    }
    for (const schedule of entry.schedules) {
      walk(index + 1, [
        ...assignments,
        ...schedule.map((chosen) => ({
          sessionId: chosen.id,
          membershipId: entry.membershipId,
          pinned: false,
          reason: "brute force",
        })),
      ]);
    }
  };
  walk(0, []);
  return best;
}

const blockedCase: OptimizerInput = {
  sessions: [
    session("a1", "Agents deep dive", 0, 1, "Build"),
    session("a2", "Evals deep dive", 0, 1, "Eval"),
    session("b1", "Agents in production", 1.5, 1, "Build"),
    session("b2", "Eval tooling", 1.5, 1, "Eval"),
    session("c1", "Cost control", 3, 1, "Infra"),
    session("c2", "Reliability drills", 3, 1, "Eval"),
  ],
  goals: [goal("g-agents", "Agents", 5), goal("g-evals", "Evals", 3)],
  members: [member("m1", "Ada"), member("m2", "Brian"), member("m3", "Cleo")],
  scores: [
    score("a1", "g-agents", 0.8),
    score("a1", "g-evals", 0.1),
    score("a2", "g-agents", 0.2),
    score("a2", "g-evals", 0.7),
    score("b1", "g-agents", 0.65),
    score("b1", "g-evals", 0.15),
    score("b2", "g-agents", 0.1),
    score("b2", "g-evals", 0.8),
    score("c1", "g-agents", 0.3),
    score("c1", "g-evals", 0.2),
    score("c2", "g-agents", 0.15),
    score("c2", "g-evals", 0.6),
  ],
  preferences: [preference("m2", "b2", "interested"), preference("m3", "c1", "interested")],
  blocks: [block("m1", 0, 1.25, "Morning standup")],
};

const overlappingCase: OptimizerInput = {
  sessions: [
    session("long", "Half-day workshop", 0, 1.5, "Workshop"),
    session("mid1", "Short talk one", 0.5, 0.5, "Main"),
    session("mid2", "Short talk two", 0.5, 0.5, "Side"),
    session("late1", "Closing panel", 1.5, 1, "Main"),
    session("late2", "Closing lab", 1.5, 1, "Side"),
  ],
  goals: [goal("g-agents", "Agents", 4), goal("g-infra", "Infra", 2)],
  members: [member("m1", "Ada"), member("m2", "Brian"), member("m3", "Cleo")],
  scores: [
    score("long", "g-agents", 0.7),
    score("long", "g-infra", 0.5),
    score("mid1", "g-agents", 0.45),
    score("mid1", "g-infra", 0.1),
    score("mid2", "g-agents", 0.1),
    score("mid2", "g-infra", 0.6),
    score("late1", "g-agents", 0.55),
    score("late1", "g-infra", 0.2),
    score("late2", "g-agents", 0.2),
    score("late2", "g-infra", 0.7),
  ],
  preferences: [preference("m1", "mid2", "interested")],
  blocks: [],
};

describe("beam search against brute force", () => {
  it("matches the true optimum with a block in play", () => {
    const outcome = optimizePlan(blockedCase);
    if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
    const best = bestObjectiveByBruteForce(blockedCase);
    expect(outcome.objective.objective).toBeGreaterThan(best - TOLERANCE);
    expect(Math.abs(outcome.objective.objective - best)).toBeLessThan(TOLERANCE);
  });

  it("matches the true optimum when sessions overlap across windows", () => {
    const outcome = optimizePlan(overlappingCase);
    if (outcome.kind !== "plan") throw new Error("Expected a feasible plan");
    const best = bestObjectiveByBruteForce(overlappingCase);
    expect(outcome.objective.objective).toBeGreaterThan(best - TOLERANCE);
    expect(Math.abs(outcome.objective.objective - best)).toBeLessThan(TOLERANCE);
  });
});
