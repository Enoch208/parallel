import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertWritable } from "./model/frozenConference";

export const createThread = mutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await assertWritable(ctx, args.conferenceId);
    const existing = await ctx.db
      .query("emailThreads")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing !== null) {
      return { threadId: existing._id, created: false };
    }

    const threadId = await ctx.db.insert("emailThreads", {
      conferenceId: args.conferenceId,
      membershipId: args.membershipId,
      providerThreadId: null,
      token: args.token,
    });

    return { threadId, created: true };
  },
});
