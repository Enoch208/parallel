import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { bumpConstraintRevision } from "./constraints";
import { assertWritable } from "./model/frozenConference";

const stance = v.union(v.literal("interested"), v.literal("avoid"), v.literal("pinned"));

export const addTeammate = mutation({
  args: {
    conferenceId: v.id("conferences"),
    displayName: v.string(),
    email: v.string(),
    isLead: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertWritable(ctx, args.conferenceId);
    if (args.displayName.trim().length === 0) {
      throw new Error("A teammate needs a name");
    }

    if (!args.email.includes("@")) {
      throw new Error("A teammate needs a valid email address");
    }

    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
      .collect();

    const already = existing.find((member) => member.email === args.email);

    if (already !== undefined) {
      return { membershipId: already._id, created: false };
    }

    const membershipId = await ctx.db.insert("memberships", {
      teamId: conference.teamId,
      displayName: args.displayName.trim(),
      email: args.email,
      isLead: args.isLead,
    });

    await bumpConstraintRevision(ctx, args.conferenceId);

    return { membershipId, created: true };
  },
});

export const addGoal = mutation({
  args: { conferenceId: v.id("conferences"), label: v.string(), weight: v.number() },
  handler: async (ctx, args) => {
    await assertWritable(ctx, args.conferenceId);
    if (args.label.trim().length === 0) {
      throw new Error("A goal needs a label");
    }

    if (!Number.isInteger(args.weight) || args.weight < 1 || args.weight > 5) {
      throw new Error("Goal weight must be a whole number from 1 to 5");
    }

    const goalId = await ctx.db.insert("goals", {
      conferenceId: args.conferenceId,
      label: args.label.trim(),
      weight: args.weight,
    });

    await bumpConstraintRevision(ctx, args.conferenceId);

    return { goalId };
  },
});

export const setPreference = mutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    sessionId: v.id("sessions"),
    stance,
  },
  handler: async (ctx, args) => {
    await assertWritable(ctx, args.conferenceId);
    const existing = await ctx.db
      .query("memberPreferences")
      .withIndex("by_member", (q) =>
        q.eq("conferenceId", args.conferenceId).eq("membershipId", args.membershipId),
      )
      .collect();

    const current = existing.find((row) => row.sessionId === args.sessionId);

    if (current !== undefined) {
      await ctx.db.patch(current._id, { stance: args.stance });
    } else {
      await ctx.db.insert("memberPreferences", {
        conferenceId: args.conferenceId,
        membershipId: args.membershipId,
        sessionId: args.sessionId,
        stance: args.stance,
      });
    }

    await bumpConstraintRevision(ctx, args.conferenceId);

    return { stance: args.stance };
  },
});

export const clearPreference = mutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await assertWritable(ctx, args.conferenceId);
    const existing = await ctx.db
      .query("memberPreferences")
      .withIndex("by_member", (q) =>
        q.eq("conferenceId", args.conferenceId).eq("membershipId", args.membershipId),
      )
      .collect();

    const current = existing.find((row) => row.sessionId === args.sessionId);

    if (current === undefined) {
      return { cleared: false };
    }

    await ctx.db.delete(current._id);
    await bumpConstraintRevision(ctx, args.conferenceId);

    return { cleared: true };
  },
});
