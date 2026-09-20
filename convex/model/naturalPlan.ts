import { overlaps, sortedSessions } from "../engine";
import type { OptimizerInput } from "../engine";
import type { AssignmentSummary, SessionSummary } from "./types";

const naturalReason = "Picked by this teammate before the team coordinated";

export function naturalAssignments(input: OptimizerInput): AssignmentSummary[] {
  const ordered = sortedSessions(input.sessions);
  const byId = new Map<string, SessionSummary>(ordered.map((session) => [session.id, session]));
  const assignments: AssignmentSummary[] = [];

  for (const member of input.members) {
    const wanted = input.preferences
      .filter(
        (preference) =>
          preference.membershipId === member.id &&
          (preference.stance === "interested" || preference.stance === "pinned"),
      )
      .map((preference) => byId.get(preference.sessionId))
      .filter((session): session is SessionSummary => session !== undefined)
      .sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));

    const taken: SessionSummary[] = [];

    for (const session of wanted) {
      const clashes = taken.some((existing) => overlaps(existing, session));

      if (!clashes) {
        taken.push(session);
        assignments.push({
          sessionId: session.id,
          membershipId: member.id,
          pinned: false,
          reason: naturalReason,
        });
      }
    }
  }

  return assignments;
}
