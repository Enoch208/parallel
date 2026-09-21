import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { computeCoverageSummary } from "../engine";
import { buildTripSummary } from "./briefSchema";
import type { TripSummary } from "./briefSchema";
import { loadOptimizerInput } from "./loadOptimizerInput";
import { naturalAssignments } from "./naturalPlan";

export async function loadTripSummary(
  ctx: QueryCtx,
  conference: Doc<"conferences">,
  tripCostEstimate: number | null,
): Promise<TripSummary> {
  const [plan, noteRows, input] = await Promise.all([
    ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conference._id))
      .order("desc")
      .first(),
    ctx.db
      .query("notes")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
      .collect(),
    loadOptimizerInput(ctx, conference._id, conference.agendaUrl),
  ]);

  const assignments =
    plan === null
      ? []
      : (
          await ctx.db
            .query("assignments")
            .withIndex("by_plan", (q) => q.eq("planId", plan._id))
            .collect()
        ).map((row) => ({
          sessionId: row.sessionId,
          membershipId: row.membershipId,
          pinned: row.pinned,
          reason: row.reason,
        }));

  return buildTripSummary({
    eventName: conference.name,
    attendees: input.members.length,
    tripCostEstimate,
    sessionsAvailable: input.sessions.length,
    before: computeCoverageSummary(input, naturalAssignments(input)),
    after: computeCoverageSummary(input, assignments),
    noteSessionIds: noteRows
      .filter((note) => note.approved !== false)
      .map((note) => note.sessionId),
  });
}
