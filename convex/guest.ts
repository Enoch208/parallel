import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const guestLifetimeMs = 24 * 60 * 60 * 1000;

async function deleteConferenceGraph(
  ctx: MutationCtx,
  conferenceId: Id<"conferences">,
): Promise<number> {
  let removed = 0;

  const plans = await ctx.db
    .query("plans")
    .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
    .collect();

  for (const plan of plans) {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
      removed += 1;
    }

    await ctx.db.delete(plan._id);
    removed += 1;
  }

  const byConference = [
    "sessions",
    "goals",
    "sessionGoalScores",
    "memberPreferences",
    "availabilityBlocks",
    "sources",
    "activity",
    "emailThreads",
    "coverRequests",
    "notes",
    "briefs",
    "outboundSends",
  ] as const;

  for (const table of byConference) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
      removed += 1;
    }
  }

  const conference = await ctx.db.get(conferenceId);

  if (conference !== null) {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
      removed += 1;
    }

    await ctx.db.delete(conferenceId);
    await ctx.db.delete(conference.teamId);
    removed += 2;
  }

  return removed;
}

export const resetWorkspace = mutation({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return { removed: 0, wasDemo: false };
    }

    if (!conference.isDemoData) {
      throw new Error("Only a demo workspace can be reset");
    }

    const removed = await deleteConferenceGraph(ctx, args.conferenceId);

    return { removed, wasDemo: true };
  },
});

export const expiredGuestWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - guestLifetimeMs;
    const conferences = await ctx.db.query("conferences").collect();

    return conferences
      .filter((conference) => conference.isDemoData && conference._creationTime < cutoff)
      .map((conference) => ({ id: conference._id, createdAt: conference._creationTime }));
  },
});

export const cleanupExpiredGuests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - guestLifetimeMs;
    const conferences = await ctx.db.query("conferences").collect();
    let workspaces = 0;
    let rows = 0;

    for (const conference of conferences) {
      if (!conference.isDemoData || conference._creationTime >= cutoff) {
        continue;
      }

      rows += await deleteConferenceGraph(ctx, conference._id);
      workspaces += 1;
    }

    return { workspaces, rows };
  },
});
