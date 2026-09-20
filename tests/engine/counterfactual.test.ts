import { describe, expect, it } from "vitest";
import { explainAssignment, explainSession } from "../../convex/engine/counterfactual";
import { overlaps } from "../../convex/engine/intervals";
import { scoreAssignments } from "../../convex/engine/objective";
import { computeCoverageSummary } from "../../convex/engine/coverage";
import { optimizePlan } from "../../convex/engine/optimize";
import type { OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary } from "../../convex/model/types";
import { block, goal, member, preference, score, session } from "./fixtures";
import { mediumShape, randomInstance } from "./random-instances";

const ABSORPTION = 0.75;

const team: OptimizerInput = {
  sessions: [
    session("s1", "Platform deep dive", 0, 1, "A"),
    session("s2", "Security clinic", 0, 1, "B"),
    session("s3", "Data mesh in practice", 0, 1, "C"),
    session("s4", "Closing keynote", 2, 1, "A"),
    session("s5", "All morning workshop", 0, 3, "D"),
  ],
  goals: [goal("g1", "Platform", 3), goal("g2", "Security", 2)],
  members: [member("m1", "Ada"), member("m2", "Bo"), member("m3", "Cy"), member("m4", "Dee")],
  scores: [
    score("s1", "g1", 0.9),
    score("s1", "g2", 0.1),
    score("s2", "g1", 0.2),
    score("s2", "g2", 0.9),
    score("s3", "g1", 0.4),
    score("s3", "g2", 0.4),
    score("s4", "g1", 0.5),
    score("s5", "g1", 0.3),
    score("s5", "g2", 0.3),
  ],
  preferences: [preference("m3", "s3", "interested")],
  blocks: [block("m4", 0, 1, "Customer call")],
};

const plan: readonly AssignmentSummary[] = [
  { sessionId: "s1", membershipId: "m1", pinned: false, reason: "fixture" },
  { sessionId: "s2", membershipId: "m2", pinned: false, reason: "fixture" },
  { sessionId: "s4", membershipId: "m1", pinned: false, reason: "fixture" },
];

function relevanceOf(input: OptimizerInput, sessionId: string, goalId: string): number {
  const found = input.scores.find(
    (entry) => entry.sessionId === sessionId && entry.goalId === goalId,
  );
  return found === undefined ? 0 : found.relevance;
}

function independentCoverage(input: OptimizerInput, sessionIds: readonly string[]): number {
  const unique = [...new Set(sessionIds)].sort();
  let weighted = 0;
  let total = 0;
  for (const entry of input.goals) {
    let product = 1;
    for (const sessionId of unique) {
      product *= 1 - ABSORPTION * relevanceOf(input, sessionId, entry.id);
    }
    weighted += entry.weight * (1 - product);
    total += entry.weight;
  }
  return (100 * weighted) / total;
}

function attended(assignments: readonly AssignmentSummary[]): string[] {
  return assignments.map((entry) => entry.sessionId);
}

function without(
  assignments: readonly AssignmentSummary[],
  membershipId: string,
  sessionId: string,
): AssignmentSummary[] {
  return assignments.filter(
    (entry) => entry.membershipId !== membershipId || entry.sessionId !== sessionId,
  );
}

function swapped(
  assignments: readonly AssignmentSummary[],
  membershipId: string,
  fromSessionId: string,
  toSessionId: string,
): AssignmentSummary[] {
  return [
    ...without(assignments, membershipId, fromSessionId),
    { sessionId: toSessionId, membershipId, pinned: false, reason: "recheck" },
  ];
}

describe("marginal contribution", () => {
  it("equals the objective difference scoreAssignments computes independently", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const withIt = scoreAssignments(team, plan);
    const withoutIt = scoreAssignments(team, without(plan, "m1", "s1"));

    expect(explanation.marginal.withAssignment).toEqual(withIt);
    expect(explanation.marginal.withoutAssignment).toEqual(withoutIt);
    expect(explanation.marginal.delta.objective).toBe(withIt.objective - withoutIt.objective);
    expect(explanation.marginal.delta.teamGoalCoverage).toBe(
      withIt.teamGoalCoverage - withoutIt.teamGoalCoverage,
    );
    expect(explanation.marginal.delta.uniqueSessions).toBe(1);
  });

  it("matches the coverage formula computed by hand", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const byHand =
      independentCoverage(team, attended(plan)) -
      independentCoverage(team, attended(without(plan, "m1", "s1")));

    expect(explanation.marginal.delta.teamGoalCoverage).toBeCloseTo(byHand, 9);
    expect(byHand).toBeGreaterThan(0);
  });

  it("names the goal the assignment contributes most to", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const top = explanation.marginal.delta.topGoal;

    expect(top).not.toBeNull();
    expect(top === null ? null : top.goalId).toBe("g1");
    expect(top === null ? 0 : top.weightedDelta).toBeGreaterThan(0);
  });

  it("reports a duplicate attendance the objective actually penalises", () => {
    const doubled: AssignmentSummary[] = [
      ...plan,
      { sessionId: "s1", membershipId: "m3", pinned: false, reason: "fixture" },
    ];
    const explanation = explainAssignment(team, doubled, "m3", "s1");
    const withIt = scoreAssignments(team, doubled);
    const withoutIt = scoreAssignments(team, without(doubled, "m3", "s1"));

    expect(explanation.marginal.delta.duplicateAttendances).toBe(1);
    expect(explanation.marginal.delta.duplicatePenalty).toBe(
      withIt.duplicatePenalty - withoutIt.duplicatePenalty,
    );
    expect(explanation.marginal.delta.objective).toBe(withIt.objective - withoutIt.objective);
  });
});

describe("next-best alternative", () => {
  it("is genuinely worse and every delta recomputes", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const actual = scoreAssignments(team, plan);

    expect(explanation.alternatives.length).toBeGreaterThan(0);
    for (const alternative of explanation.alternatives) {
      const recomputed = scoreAssignments(team, swapped(plan, "m1", "s1", alternative.sessionId));
      expect(alternative.breakdown).toEqual(recomputed);
      expect(alternative.delta.objective).toBe(recomputed.objective - actual.objective);
      expect(alternative.delta.objective).toBeLessThan(0);
    }
  });

  it("orders the alternatives best first", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const order = explanation.alternatives.map((entry) => entry.sessionId);

    expect(order).toEqual(["s3", "s2"]);
    const objectives = explanation.alternatives.map((entry) => entry.delta.objective);
    expect(objectives).toEqual([...objectives].sort((left, right) => right - left));
  });

  it("excludes a session that would overlap another assignment, with the overlap named", () => {
    const explanation = explainAssignment(team, plan, "m1", "s1");
    const blockedOut = explanation.excluded.find((entry) => entry.sessionId === "s5");

    expect(blockedOut).toBeDefined();
    expect(blockedOut === undefined ? null : blockedOut.exclusion.kind).toBe("overlap");
    expect(blockedOut === undefined ? null : blockedOut.exclusion.conflictingSessionId).toBe("s4");
    expect(explanation.alternatives.some((entry) => entry.sessionId === "s5")).toBe(false);
  });

  it("excludes a session inside an availability block, with the block reason", () => {
    const withDee: AssignmentSummary[] = [
      ...plan,
      { sessionId: "s4", membershipId: "m4", pinned: false, reason: "fixture" },
    ];
    const explanation = explainAssignment(team, withDee, "m4", "s4");

    expect(explanation.alternatives).toEqual([]);
    expect(explanation.excluded).toEqual([]);

    const session = explainSession(team, withDee, "s3");
    const dee = session.candidates.find((entry) => entry.membershipId === "m4");

    expect(dee === undefined ? null : dee.exclusion).toEqual({
      kind: "blocked",
      conflictingSessionId: null,
      conflictingSessionTitle: null,
      blockReason: "Customer call",
    });
    expect(dee === undefined ? "set" : dee.delta).toBeNull();
  });
});

describe("session candidates", () => {
  it("ranks the free teammate first and names why the others cannot", () => {
    const explanation = explainSession(team, plan, "s3");
    const order = explanation.candidates.map((entry) => entry.membershipId);

    expect(order).toEqual(["m3", "m1", "m2", "m4"]);
    const [free] = explanation.candidates;
    expect(free === undefined ? null : free.exclusion).toBeNull();

    const kinds = explanation.candidates.map((entry) =>
      entry.exclusion === null ? null : entry.exclusion.kind,
    );
    expect(kinds).toEqual([null, "overlap", "overlap", "blocked"]);
    const ada = explanation.candidates.find((entry) => entry.membershipId === "m1");
    expect(ada === undefined ? null : (ada.exclusion?.conflictingSessionId ?? null)).toBe("s1");
  });

  it("recomputes the coverage each free teammate would restore", () => {
    const explanation = explainSession(team, plan, "s3");
    const base = computeCoverageSummary(team, plan);

    for (const candidate of explanation.candidates) {
      if (candidate.delta === null) continue;
      const added = computeCoverageSummary(team, [
        ...plan,
        { sessionId: "s3", membershipId: candidate.membershipId, pinned: false, reason: "recheck" },
      ]);
      expect(candidate.delta.teamGoalCoverage).toBe(added.teamGoalCoverage - base.teamGoalCoverage);
      expect(candidate.delta.teamGoalCoverage).toBeGreaterThan(0);
    }
  });

  it("marks a teammate already in the session as already taken", () => {
    const explanation = explainSession(team, plan, "s1");
    const ada = explanation.candidates.find((entry) => entry.membershipId === "m1");

    expect(ada === undefined ? null : (ada.exclusion?.kind ?? null)).toBe("already_taken");
    expect(explanation.attendeeMembershipIds).toEqual(["m1"]);
  });
});

describe("determinism", () => {
  it("returns the same result for the same inputs", () => {
    expect(explainAssignment(team, plan, "m1", "s1")).toEqual(
      explainAssignment(team, plan, "m1", "s1"),
    );
    expect(explainSession(team, plan, "s3")).toEqual(explainSession(team, plan, "s3"));
  });

  it("does not depend on the order of the input arrays", () => {
    const reversed: OptimizerInput = {
      sessions: [...team.sessions].reverse(),
      goals: [...team.goals].reverse(),
      members: [...team.members].reverse(),
      scores: [...team.scores].reverse(),
      preferences: [...team.preferences].reverse(),
      blocks: [...team.blocks].reverse(),
    };

    expect(explainAssignment(reversed, [...plan].reverse(), "m1", "s1")).toEqual(
      explainAssignment(team, plan, "m1", "s1"),
    );
    expect(explainSession(reversed, [...plan].reverse(), "s3")).toEqual(
      explainSession(team, plan, "s3"),
    );
  });
});

function pickAssignment(assignments: readonly AssignmentSummary[]): AssignmentSummary | undefined {
  return [...assignments].sort((left, right) =>
    `${left.membershipId}/${left.sessionId}`.localeCompare(
      `${right.membershipId}/${right.sessionId}`,
    ),
  )[0];
}

describe("random instances", () => {
  it("reports deltas that recompute from scoreAssignments on 200 planned instances", () => {
    let checked = 0;
    for (let seed = 1; checked < 200 && seed <= 800; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const outcome = optimizePlan(input);
      if (outcome.kind !== "plan") continue;
      const chosen = pickAssignment(outcome.assignments);
      if (chosen === undefined) continue;

      const assignments = outcome.assignments;
      const explanation = explainAssignment(
        input,
        assignments,
        chosen.membershipId,
        chosen.sessionId,
      );
      const actual = scoreAssignments(input, assignments);
      const dropped = scoreAssignments(
        input,
        without(assignments, chosen.membershipId, chosen.sessionId),
      );

      expect(explanation.marginal.delta.objective).toBe(actual.objective - dropped.objective);
      expect(explanation.marginal.delta.teamGoalCoverage).toBe(
        actual.teamGoalCoverage - dropped.teamGoalCoverage,
      );

      for (const alternative of explanation.alternatives) {
        const recomputed = scoreAssignments(
          input,
          swapped(assignments, chosen.membershipId, chosen.sessionId, alternative.sessionId),
        );
        expect(alternative.delta.objective).toBe(recomputed.objective - actual.objective);
      }

      const sessionById = new Map(input.sessions.map((entry) => [entry.id, entry] as const));
      for (const excluded of explanation.excluded) {
        const target = sessionById.get(excluded.sessionId);
        expect(target).toBeDefined();
        if (target === undefined) continue;
        const kind = excluded.exclusion.kind;
        if (kind === "blocked") {
          expect(
            input.blocks.some(
              (entry) => entry.membershipId === chosen.membershipId && overlaps(entry, target),
            ),
          ).toBe(true);
          continue;
        }
        const conflicting = excluded.exclusion.conflictingSessionId;
        expect(conflicting).not.toBeNull();
        const other = conflicting === null ? undefined : sessionById.get(conflicting);
        expect(other === undefined ? false : overlaps(other, target)).toBe(true);
      }

      checked += 1;
    }

    expect(checked).toBeGreaterThanOrEqual(200);
  });

  it("explains every session of a planned instance without losing a candidate", () => {
    let checked = 0;
    for (let seed = 1; checked < 200 && seed <= 800; seed += 1) {
      const input = randomInstance(seed, mediumShape);
      const outcome = optimizePlan(input);
      if (outcome.kind !== "plan") continue;
      const target = input.sessions[seed % input.sessions.length];
      if (target === undefined) continue;

      const explanation = explainSession(input, outcome.assignments, target.id);
      expect(explanation.candidates).toHaveLength(input.members.length);

      const base = computeCoverageSummary(input, outcome.assignments);
      for (const candidate of explanation.candidates) {
        if (candidate.delta === null) continue;
        const added = computeCoverageSummary(input, [
          ...outcome.assignments,
          {
            sessionId: target.id,
            membershipId: candidate.membershipId,
            pinned: false,
            reason: "recheck",
          },
        ]);
        expect(candidate.delta.teamGoalCoverage).toBe(
          added.teamGoalCoverage - base.teamGoalCoverage,
        );
      }

      checked += 1;
    }

    expect(checked).toBeGreaterThanOrEqual(200);
  });
});
