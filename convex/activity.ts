import { v } from "convex/values";
import { query } from "./_generated/server";
import { maskAddressesIn } from "./model/privacy";

export const recent = query({
  args: { conferenceId: v.id("conferences"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);
    const hide = conference?.frozen === true;
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .take(args.limit ?? 12);

    return rows.map((row) => ({
      id: row._id,
      kind: row.kind,
      sponsor: row.sponsor,
      durationMs: row.durationMs,
      summary: hide ? maskAddressesIn(row.summary) : row.summary,
      at: row._creationTime,
    }));
  },
});
