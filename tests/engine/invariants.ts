import { computeCoverageSummary } from "../../convex/engine/coverage";
import { overlaps } from "../../convex/engine/intervals";
import { scoreAssignments } from "../../convex/engine/objective";
import { objectiveUpperBound } from "../../convex/engine/bounds";
import type { OptimizeOutcome, OptimizerInput } from "../../convex/engine/types";
import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";

const TOLERANCE = 1e-9;

export function sessionById(input: OptimizerInput, sessionId: string): SessionSummary {
  const found = input.sessions.find((entry) => entry.id === sessionId);
  if (found === undefined) throw new Error(`Unknown session ${sessionId}`);
  return found;
}

function assignedSessions(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
  membershipId: string,
): SessionSummary[] {
  return assignments
    .filter((assignment) => assignment.membershipId === membershipId)
    .map((assignment) => sessionById(input, assignment.sessionId));
}

export function pinnedPairs(input: OptimizerInput): { member: string; session: string }[] {
  return input.preferences
    .filter((entry) => entry.stance === "pinned")
    .map((entry) => ({ member: entry.membershipId, session: entry.sessionId }));
}

export function unsatisfiablePinIds(input: OptimizerInput): string[] {
  const ids = new Set<string>();
  const memberIds = new Set(input.members.map((teammate) => teammate.id));
  for (const teammate of input.members) {
    const pins = pinnedPairs(input).filter((pin) => pin.member === teammate.id);
    const blocks = input.blocks.filter((entry) => entry.membershipId === teammate.id);
    const resolved: SessionSummary[] = [];
    for (const pin of pins) {
      const found = input.sessions.find((entry) => entry.id === pin.session);
      if (found === undefined) {
        ids.add(pin.session);
        continue;
      }
      if (blocks.some((entry) => overlaps(entry, found))) {
        ids.add(pin.session);
        continue;
      }
      resolved.push(found);
    }
    for (let left = 0; left < resolved.length; left += 1) {
      for (let right = left + 1; right < resolved.length; right += 1) {
        const first = resolved[left];
        const second = resolved[right];
        if (first === undefined || second === undefined) continue;
        if (!overlaps(first, second)) continue;
        ids.add(first.id);
        ids.add(second.id);
      }
    }
  }
  for (const pin of pinnedPairs(input)) {
    if (!memberIds.has(pin.member)) ids.add(pin.session);
  }
  return [...ids].sort();
}

function overlapFailures(
  input: OptimizerInput,
  assignments: readonly AssignmentSummary[],
): string[] {
  const failures: string[] = [];
  for (const teammate of input.members) {
    const mine = assignedSessions(input, assignments, teammate.id);
    for (let left = 0; left < mine.length; left += 1) {
      for (let right = left + 1; right < mine.length; right += 1) {
        const first = mine[left];
        const second = mine[right];
        if (first === undefined || second === undefined) continue;
        if (overlaps(first, second)) {
          failures.push(`${teammate.id} holds overlapping ${first.id} and ${second.id}`);
        }
      }
    }
  }
  return failures;
}

function blockFailures(input: OptimizerInput, assignments: readonly AssignmentSummary[]): string[] {
  const failures: string[] = [];
  for (const assignment of assignments) {
    const entry = sessionById(input, assignment.sessionId);
    for (const unavailable of input.blocks) {
      if (unavailable.membershipId !== assignment.membershipId) continue;
      if (overlaps(unavailable, entry)) {
        failures.push(`${assignment.membershipId} is booked into blocked ${entry.id}`);
      }
    }
  }
  return failures;
}

function avoidFailures(input: OptimizerInput, assignments: readonly AssignmentSummary[]): string[] {
  const avoided = new Set(
    input.preferences
      .filter((entry) => entry.stance === "avoid")
      .map((entry) => `${entry.membershipId}\u0000${entry.sessionId}`),
  );
  return assignments
    .filter((assignment) => avoided.has(`${assignment.membershipId}\u0000${assignment.sessionId}`))
    .map((assignment) => `${assignment.membershipId} was assigned avoided ${assignment.sessionId}`);
}

function duplicateAssignmentFailures(assignments: readonly AssignmentSummary[]): string[] {
  const seen = new Set<string>();
  const failures: string[] = [];
  for (const assignment of assignments) {
    const key = `${assignment.membershipId}\u0000${assignment.sessionId}`;
    if (seen.has(key)) failures.push(`${key} appears twice in the plan`);
    seen.add(key);
  }
  return failures;
}

function pinFailures(input: OptimizerInput, assignments: readonly AssignmentSummary[]): string[] {
  const held = new Set(
    assignments.map((assignment) => `${assignment.membershipId}\u0000${assignment.sessionId}`),
  );
  return pinnedPairs(input)
    .filter((pin) => !held.has(`${pin.member}\u0000${pin.session}`))
    .map((pin) => `pin ${pin.session} for ${pin.member} was dropped`);
}

function coverageFailures(input: OptimizerInput, outcome: OptimizeOutcome): string[] {
  if (outcome.kind !== "plan") return [];
  const recomputed = computeCoverageSummary(input, outcome.assignments);
  const failures: string[] = [];
  if (JSON.stringify(recomputed) !== JSON.stringify(outcome.coverage)) {
    failures.push("recomputed coverage differs from the reported coverage");
  }
  const scored = scoreAssignments(input, outcome.assignments);
  const reported = outcome.objective.objective + outcome.objective.changePenalty;
  if (Math.abs(scored.objective - reported) > TOLERANCE) {
    failures.push(
      `reported objective ${String(reported)} differs from a rescore ${String(scored.objective)}`,
    );
  }
  const bound = objectiveUpperBound(input);
  if (outcome.objective.objective > bound + TOLERANCE) {
    failures.push(
      `objective ${String(outcome.objective.objective)} exceeds the upper bound ${String(bound)}`,
    );
  }
  return failures;
}

export function outcomeFailures(input: OptimizerInput, outcome: OptimizeOutcome): string[] {
  const unsatisfiable = unsatisfiablePinIds(input);
  if (outcome.kind === "infeasible") {
    const named = [...outcome.blockingPinnedSessionIds].sort();
    if (unsatisfiable.length === 0) return ["reported infeasible with every pin satisfiable"];
    const missing = unsatisfiable.filter((id) => !named.includes(id));
    return missing.map((id) => `infeasible outcome did not name blocking pin ${id}`);
  }
  if (unsatisfiable.length > 0) {
    return [`planned around unsatisfiable pins ${unsatisfiable.join(", ")}`];
  }
  return [
    ...overlapFailures(input, outcome.assignments),
    ...blockFailures(input, outcome.assignments),
    ...avoidFailures(input, outcome.assignments),
    ...duplicateAssignmentFailures(outcome.assignments),
    ...pinFailures(input, outcome.assignments),
    ...coverageFailures(input, outcome),
  ];
}
