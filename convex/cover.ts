import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { rankCoverCandidates } from "./model/coverRanking";
import { loadCoverInput } from "./model/loadCoverInput";
import {
  applyCoverAcceptance,
  declineCoverRequest,
  type CoverAcceptance,
} from "./model/coverAcceptance";

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
    const request = await ctx.db.get(args.requestId);

    if (request === null || request.status !== "proposed") {
      return { status: request === null ? null : request.status };
    }

    await ctx.db.patch(args.requestId, { status: "asked" });
    return { status: "asked" as const };
  },
});

export const acceptCover = mutation({
  args: { requestId: v.id("coverRequests"), expectedRevision: v.optional(v.number()) },
  handler: (ctx, args): Promise<CoverAcceptance> =>
    applyCoverAcceptance(ctx, args.requestId, args.expectedRevision ?? null, "app"),
});

export const declineCover = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: (ctx, args) => declineCoverRequest(ctx, args.requestId),
});
