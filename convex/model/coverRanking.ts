import { computeCoverageSummary, overlaps } from "../engine";
import type { AvailabilityBlockSummary, CoverageInput, MemberPreferenceSummary } from "../engine";
import type { AssignmentSummary, SessionSummary } from "./types";

export interface CoverCandidate {
  readonly membershipId: string;
  readonly displayName: string;
  readonly coverageGain: number;
  readonly topGoalLabel: string | null;
  readonly reasons: readonly string[];
}

export interface CoverInput extends CoverageInput {
  readonly assignments: readonly AssignmentSummary[];
  readonly blocks: readonly AvailabilityBlockSummary[];
  readonly preferences: readonly MemberPreferenceSummary[];
}

function sessionById(sessions: readonly SessionSummary[], id: string): SessionSummary | null {
  for (const session of sessions) {
    if (session.id === id) {
      return session;
    }
  }

  return null;
}

function isFree(input: CoverInput, membershipId: string, session: SessionSummary): boolean {
  for (const block of input.blocks) {
    if (block.membershipId === membershipId && overlaps(block, session)) {
      return false;
    }
  }

  for (const assignment of input.assignments) {
    if (assignment.membershipId !== membershipId) {
      continue;
    }

    if (assignment.sessionId === session.id) {
      return false;
    }

    const other = sessionById(input.sessions, assignment.sessionId);

    if (other !== null && overlaps(other, session)) {
      return false;
    }
  }

  return true;
}

function marksInterest(input: CoverInput, membershipId: string, sessionId: string): boolean {
  return input.preferences.some(
    (preference) =>
      preference.membershipId === membershipId &&
      preference.sessionId === sessionId &&
      (preference.stance === "interested" || preference.stance === "pinned"),
  );
}

export function rankCoverCandidates(input: CoverInput, sessionId: string): CoverCandidate[] {
  const session = sessionById(input.sessions, sessionId);

  if (session === null) {
    return [];
  }

  const base = computeCoverageSummary(input, input.assignments);
  const candidates: CoverCandidate[] = [];

  for (const member of input.members) {
    if (!isFree(input, member.id, session)) {
      continue;
    }

    const withCover = computeCoverageSummary(input, [
      ...input.assignments,
      { sessionId, membershipId: member.id, pinned: false, reason: "cover" },
    ]);

    const coverageGain = withCover.teamGoalCoverage - base.teamGoalCoverage;
    let topGoalLabel: string | null = null;
    let bestDelta = 0;

    for (const goal of withCover.perGoal) {
      const before = base.perGoal.find((entry) => entry.goalId === goal.goalId);
      const delta = goal.coverage - (before === undefined ? 0 : before.coverage);

      if (delta > bestDelta) {
        bestDelta = delta;
        topGoalLabel = goal.label;
      }
    }

    const reasons = ["No schedule conflict"];
    const points = Number(coverageGain.toFixed(1));

    if (points >= 0.1) {
      reasons.push(
        topGoalLabel === null
          ? `Restores ${points.toFixed(1)} Team Goal Coverage points`
          : `Restores ${points.toFixed(1)} Team Goal Coverage points, mostly on ${topGoalLabel}`,
      );
    } else {
      reasons.push("Keeps the session covered without leaving another goal short");
    }

    if (marksInterest(input, member.id, sessionId)) {
      reasons.push("Already marked interested in this session");
    }

    reasons.push("Only one person's plan changes");

    candidates.push({
      membershipId: member.id,
      displayName: member.displayName,
      coverageGain,
      topGoalLabel,
      reasons,
    });
  }

  const ordered = candidates.map((candidate) => ({
    candidate,
    interested: marksInterest(input, candidate.membershipId, sessionId),
    load: input.assignments.filter(
      (assignment) => assignment.membershipId === candidate.membershipId,
    ).length,
  }));

  ordered.sort(
    (left, right) =>
      right.candidate.coverageGain - left.candidate.coverageGain ||
      Number(right.interested) - Number(left.interested) ||
      left.load - right.load ||
      left.candidate.membershipId.localeCompare(right.candidate.membershipId),
  );

  return ordered.map((entry) => entry.candidate);
}
