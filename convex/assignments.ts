import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  assertNoOverlap,
  assertNotBlocked,
  requireCurrentPlan,
  requireSession,
} from "./model/assignmentGuards";

export const claim = mutation({
  args: {
    planId: v.id("plans"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { plan } = await requireCurrentPlan(ctx, args.planId, args.expectedRevision);
    const session = await requireSession(ctx, args.sessionId);

    await assertNotBlocked(ctx, plan.conferenceId, args.membershipId, session);

    const { alreadyAssigned } = await assertNoOverlap(ctx, args.planId, args.membershipId, session);

    if (alreadyAssigned) {
      return { claimed: false, reason: "already_assigned" as const };
    }

    await ctx.db.insert("assignments", {
      planId: args.planId,
      conferenceId: plan.conferenceId,
      sessionId: args.sessionId,
      membershipId: args.membershipId,
      pinned: false,
      reason: "Claimed by this teammate",
    });

    await ctx.db.insert("activity", {
      conferenceId: plan.conferenceId,
      kind: "assignment_claimed",
      sponsor: "convex",
      durationMs: 0,
      summary: `A teammate claimed "${session.title}"`,
    });

    return { claimed: true, reason: null };
  },
});

export const release = mutation({
  args: {
    planId: v.id("plans"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { plan } = await requireCurrentPlan(ctx, args.planId, args.expectedRevision);

    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_plan_member", (q) =>
        q.eq("planId", args.planId).eq("membershipId", args.membershipId),
      )
      .collect();

    const target = existing.find((assignment) => assignment.sessionId === args.sessionId);

    if (target === undefined) {
      return { released: false, reason: "not_assigned" as const };
    }

    if (target.pinned) {
      throw new Error("That session is pinned. Unpin it before releasing it.");
    }

    const session = await ctx.db.get(args.sessionId);
    await ctx.db.delete(target._id);

    await ctx.db.insert("activity", {
      conferenceId: plan.conferenceId,
      kind: "assignment_released",
      sponsor: "convex",
      durationMs: 0,
      summary: `A teammate released "${session === null ? "a session" : session.title}"`,
    });

    return { released: true, reason: null };
  },
});
