import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { overlaps } from "./engine";

export class StalePlanError extends Error {}

async function requireCurrentPlan(
  ctx: MutationCtx,
  planId: Id<"plans">,
  expectedRevision: number,
): Promise<{ plan: Doc<"plans">; conference: Doc<"conferences"> }> {
  const plan = await ctx.db.get(planId);

  if (plan === null) {
    throw new Error("That plan no longer exists");
  }

  const conference = await ctx.db.get(plan.conferenceId);

  if (conference === null) {
    throw new Error("Conference not found");
  }

  if (conference.constraintRevision !== expectedRevision) {
    throw new StalePlanError(
      "The plan changed while you were looking at it. Reload the board and try again.",
    );
  }

  if (plan.computedAtRevision !== conference.constraintRevision) {
    throw new StalePlanError(
      "This plan is out of date with the team's constraints. Repair it before changing assignments.",
    );
  }

  return { plan, conference };
}

export const claim = mutation({
  args: {
    planId: v.id("plans"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { plan } = await requireCurrentPlan(ctx, args.planId, args.expectedRevision);
    const session = await ctx.db.get(args.sessionId);

    if (session === null) {
      throw new Error("Session not found");
    }

    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_plan_member", (q) =>
        q.eq("planId", args.planId).eq("membershipId", args.membershipId),
      )
      .collect();

    if (existing.some((assignment) => assignment.sessionId === args.sessionId)) {
      return { claimed: false, reason: "already_assigned" as const };
    }

    for (const assignment of existing) {
      const other = await ctx.db.get(assignment.sessionId);

      if (other !== null && overlaps(other, session)) {
        throw new Error(`That clashes with "${other.title}" at the same time`);
      }
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
