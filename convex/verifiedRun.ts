import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadTripSummary } from "./model/loadTripSummary";

export interface VerifiedRun {
  readonly conferenceId: string;
  readonly name: string;
  readonly coverageBefore: number;
  readonly coverageAfter: number;
  readonly sessionsCovered: number;
  readonly sessionsAvailable: number;
  readonly peopleMovedByRepair: number | null;
  readonly takeaways: number;
  readonly briefDelivered: boolean;
  readonly frozen: boolean;
}

export const verifiedRun = query({
  args: { conferenceId: v.string() },
  handler: async (ctx, args): Promise<VerifiedRun | null> => {
    const id = ctx.db.normalizeId("conferences", args.conferenceId);

    if (id === null) {
      return null;
    }

    const conference = await ctx.db.get(id);

    if (conference === null || conference.isDemoData) {
      return null;
    }

    const [plans, brief] = await Promise.all([
      ctx.db
        .query("plans")
        .withIndex("by_conference_computed", (q) => q.eq("conferenceId", id))
        .order("desc")
        .collect(),
      ctx.db
        .query("briefs")
        .withIndex("by_conference", (q) => q.eq("conferenceId", id))
        .order("desc")
        .first(),
    ]);

    const repaired = plans.find((plan) => plan.minimumChangedMembers !== undefined);
    const summary = await loadTripSummary(ctx, conference, null);

    return {
      conferenceId: conference._id,
      name: conference.name,
      coverageBefore: summary.coverageBefore,
      coverageAfter: summary.coverageAfter,
      sessionsCovered: summary.sessionsUniquelyCovered,
      sessionsAvailable: summary.sessionsAvailable,
      peopleMovedByRepair: repaired?.minimumChangedMembers ?? null,
      takeaways: summary.takeawaysCaptured,
      briefDelivered: brief !== null && brief.sentAt !== null,
      frozen: conference.frozen === true,
    };
  },
});
