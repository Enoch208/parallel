import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { rankCoverCandidates } from "./model/coverRanking";
import { loadCoverInput } from "./model/loadCoverInput";
import { bumpConstraintRevision } from "./constraints";

async function latestPlanId(
  ctx: QueryCtx | MutationCtx,
  conferenceId: Id<"conferences">,
): Promise<Id<"plans"> | null> {
  const plan = await ctx.db
    .query("plans")
    .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conferenceId))
    .order("desc")
    .first();

  return plan === null ? null : plan._id;
}

export const candidatesForSession = query({
  args: { conferenceId: v.id("conferences"), sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return [];
    }

    const planId = await latestPlanId(ctx, args.conferenceId);

    if (planId === null) {
      return [];
    }

    const input = await loadCoverInput(ctx, args.conferenceId, conference.agendaUrl, planId);

    return rankCoverCandidates(input, args.sessionId);
  },
});

export const openRequests = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) =>
    ctx.db
      .query("coverRequests")
      .withIndex("by_conference_status", (q) =>
        q.eq("conferenceId", args.conferenceId).eq("status", "asked"),
      )
      .collect(),
});

export const proposeCover = mutation({
  args: {
    conferenceId: v.id("conferences"),
    sessionId: v.id("sessions"),
    fromMember: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const planId = await latestPlanId(ctx, args.conferenceId);

    if (planId === null) {
      throw new Error("There is no plan to cover against");
    }

    const input = await loadCoverInput(ctx, args.conferenceId, conference.agendaUrl, planId);
    const ranked = rankCoverCandidates(input, args.sessionId);
    const best = ranked.find((candidate) => candidate.membershipId !== args.fromMember);

    if (best === undefined) {
      return { requestId: null, candidate: null };
    }

    const requestId = await ctx.db.insert("coverRequests", {
      conferenceId: args.conferenceId,
      planId,
      sessionId: args.sessionId,
      fromMember: args.fromMember,
      toMember: best.membershipId as Id<"memberships">,
      coverageGain: best.coverageGain,
      status: "proposed",
      reasons: [...best.reasons],
    });

    return { requestId, candidate: best };
  },
});

export const markAsked = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, { status: "asked" });
    return { status: "asked" as const };
  },
});

export const acceptCover = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);

    if (request === null) {
      throw new Error("Cover request not found");
    }

    if (request.status === "accepted") {
      return { accepted: false, reason: "already_accepted" as const };
    }

    const session = await ctx.db.get(request.sessionId);
    const member = await ctx.db.get(request.toMember);

    if (session === null || member === null) {
      throw new Error("The session or teammate no longer exists");
    }

    await ctx.db.insert("assignments", {
      planId: request.planId,
      conferenceId: request.conferenceId,
      sessionId: request.sessionId,
      membershipId: request.toMember,
      pinned: false,
      reason: `Covering after a teammate dropped out, +${request.coverageGain.toFixed(1)} Team Goal Coverage`,
    });

    await ctx.db.patch(args.requestId, { status: "accepted" });
    const revision = await bumpConstraintRevision(ctx, request.conferenceId);

    await ctx.db.insert("activity", {
      conferenceId: request.conferenceId,
      kind: "cover_accepted",
      sponsor: "agentmail",
      durationMs: 0,
      summary: `${member.displayName} accepted cover for "${session.title}". 1 person moved.`,
    });

    return { accepted: true, reason: null, constraintRevision: revision };
  },
});

export const declineCover = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, { status: "declined" });
    return { status: "declined" as const };
  },
});
