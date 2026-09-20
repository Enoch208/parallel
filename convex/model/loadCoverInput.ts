import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { CoverInput } from "./coverRanking";
import { loadOptimizerInput } from "./loadOptimizerInput";

export async function loadCoverInput(
  ctx: QueryCtx,
  conferenceId: Id<"conferences">,
  agendaUrl: string,
  planId: Id<"plans">,
): Promise<CoverInput> {
  const optimizer = await loadOptimizerInput(ctx, conferenceId, agendaUrl);

  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_plan", (q) => q.eq("planId", planId))
    .collect();

  return {
    sessions: optimizer.sessions,
    goals: optimizer.goals,
    scores: optimizer.scores,
    members: optimizer.members,
    blocks: optimizer.blocks,
    preferences: optimizer.preferences,
    assignments: rows.map((row) => ({
      sessionId: row.sessionId,
      membershipId: row.membershipId,
      pinned: row.pinned,
      reason: row.reason,
    })),
  };
}
