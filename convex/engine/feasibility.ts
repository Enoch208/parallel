import type { SessionSummary } from "../model/types";
import { overlaps } from "./intervals";
import { itemAt } from "./lookup";
import type { MemberPreferenceSummary, OptimizerInput, PinConflict } from "./types";

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function comparePreferences(left: MemberPreferenceSummary, right: MemberPreferenceSummary): number {
  const byMember = compareStrings(left.membershipId, right.membershipId);
  return byMember === 0 ? compareStrings(left.sessionId, right.sessionId) : byMember;
}

function compareConflicts(left: PinConflict, right: PinConflict): number {
  const byMember = compareStrings(left.membershipId, right.membershipId);
  if (byMember !== 0) return byMember;
  const bySessions = compareStrings(left.sessionIds.join("|"), right.sessionIds.join("|"));
  return bySessions === 0 ? compareStrings(left.kind, right.kind) : bySessions;
}

function pinsByMember(input: OptimizerInput): Map<string, string[]> {
  const pins = new Map<string, string[]>();
  for (const preference of [...input.preferences].sort(comparePreferences)) {
    if (preference.stance !== "pinned") continue;
    const existing = pins.get(preference.membershipId);
    if (existing === undefined) pins.set(preference.membershipId, [preference.sessionId]);
    else existing.push(preference.sessionId);
  }
  return pins;
}

function overlappingPinPairs(
  membershipId: string,
  resolved: readonly { readonly sessionId: string; readonly session: SessionSummary }[],
): PinConflict[] {
  const conflicts: PinConflict[] = [];
  for (let left = 0; left < resolved.length; left += 1) {
    for (let right = left + 1; right < resolved.length; right += 1) {
      const first = itemAt(resolved, left);
      const second = itemAt(resolved, right);
      if (!overlaps(first.session, second.session)) continue;
      conflicts.push({
        kind: "pin_overlap",
        membershipId,
        sessionIds: [first.sessionId, second.sessionId],
        detail: `Pinned sessions "${first.session.title}" and "${second.session.title}" run at the same time`,
      });
    }
  }
  return conflicts;
}

export function findPinConflicts(input: OptimizerInput): PinConflict[] {
  const sessionById = new Map(input.sessions.map((session) => [session.id, session] as const));
  const memberIds = new Set(input.members.map((member) => member.id));
  const conflicts: PinConflict[] = [];
  for (const [membershipId, sessionIds] of pinsByMember(input)) {
    if (!memberIds.has(membershipId)) {
      conflicts.push({
        kind: "unknown_member",
        membershipId,
        sessionIds,
        detail: `Pinned sessions belong to teammate ${membershipId}, who is not on the team`,
      });
      continue;
    }
    const memberBlocks = input.blocks.filter((block) => block.membershipId === membershipId);
    const resolved: { sessionId: string; session: SessionSummary }[] = [];
    for (const sessionId of sessionIds) {
      const session = sessionById.get(sessionId);
      if (session === undefined) {
        conflicts.push({
          kind: "unknown_session",
          membershipId,
          sessionIds: [sessionId],
          detail: `Pinned session ${sessionId} is not in the agenda`,
        });
        continue;
      }
      const blocked = memberBlocks.find((block) => overlaps(block, session));
      if (blocked !== undefined) {
        conflicts.push({
          kind: "blocked_time",
          membershipId,
          sessionIds: [sessionId],
          detail: `Pinned session "${session.title}" runs inside an unavailable block (${blocked.reason})`,
        });
        continue;
      }
      resolved.push({ sessionId, session });
    }
    conflicts.push(...overlappingPinPairs(membershipId, resolved));
  }
  return conflicts.sort(compareConflicts);
}

export function blockingPinnedSessionIds(conflicts: readonly PinConflict[]): string[] {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    for (const sessionId of conflict.sessionIds) ids.add(sessionId);
  }
  return [...ids].sort();
}
