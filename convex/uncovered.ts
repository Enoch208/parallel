import { v } from "convex/values";
import { query } from "./_generated/server";

export const droppedSessions = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    if (plan === null) {
      return [];
    }

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    const covered = new Set(assignments.map((assignment) => assignment.sessionId));

    const blocks = await ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    if (blocks.length === 0) {
      return [];
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const openRequests = await ctx.db
      .query("coverRequests")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const alreadyHandled = new Set(
      openRequests
        .filter((request) => request.status === "asked" || request.status === "accepted")
        .map((request) => request.sessionId),
    );

    return sessions
      .filter((session) => !covered.has(session._id) && !alreadyHandled.has(session._id))
      .filter((session) =>
        blocks.some((block) => block.startsAt < session.endsAt && session.startsAt < block.endsAt),
      )
      .map((session) => ({
        sessionId: session._id,
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        room: session.room,
        droppedBy:
          blocks.find((block) => block.startsAt < session.endsAt && session.startsAt < block.endsAt)
            ?.membershipId ?? null,
      }));
  },
});
