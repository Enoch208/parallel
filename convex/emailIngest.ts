import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeAddress, tokenFromSubject } from "./model/threadRouting";

interface RoutedThread {
  readonly conferenceId: Id<"conferences">;
  readonly membershipId: Id<"memberships">;
}

async function routeToThread(
  ctx: MutationCtx,
  providerThreadId: string | null,
  subject: string,
  fromAddress: string,
): Promise<RoutedThread | null> {
  if (providerThreadId !== null) {
    const byProvider = await ctx.db
      .query("emailThreads")
      .withIndex("by_provider_thread", (q) => q.eq("providerThreadId", providerThreadId))
      .first();

    if (byProvider !== null) {
      return { conferenceId: byProvider.conferenceId, membershipId: byProvider.membershipId };
    }
  }

  const token = tokenFromSubject(subject);

  if (token === null) {
    return null;
  }

  const byToken = await ctx.db
    .query("emailThreads")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (byToken === null) {
    return null;
  }

  const member = await ctx.db.get(byToken.membershipId);

  if (member === null || normalizeAddress(member.email) !== normalizeAddress(fromAddress)) {
    return null;
  }

  if (byToken.providerThreadId === null && providerThreadId !== null) {
    await ctx.db.patch(byToken._id, { providerThreadId });
  }

  return { conferenceId: byToken.conferenceId, membershipId: byToken.membershipId };
}

export const recordInbound = internalMutation({
  args: {
    providerEventId: v.string(),
    kind: v.string(),
    fromAddress: v.string(),
    subject: v.string(),
    body: v.string(),
    providerThreadId: v.union(v.string(), v.null()),
    rawPayload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("emailEvents")
      .withIndex("by_provider_event", (q) => q.eq("providerEventId", args.providerEventId))
      .first();

    if (duplicate !== null) {
      return { stored: false, unmatched: false, eventId: null };
    }

    const thread = await routeToThread(ctx, args.providerThreadId, args.subject, args.fromAddress);

    const eventId = await ctx.db.insert("emailEvents", {
      conferenceId: thread === null ? null : thread.conferenceId,
      providerEventId: args.providerEventId,
      direction: "inbound",
      kind: args.kind,
      membershipId: thread === null ? null : thread.membershipId,
      subject: args.subject,
      body: args.body,
      intent: null,
      confidence: null,
      quote: null,
      fromAddress: normalizeAddress(args.fromAddress),
      ...(args.rawPayload === undefined ? {} : { rawPayload: args.rawPayload }),
      handled: false,
    });

    if (thread !== null) {
      await ctx.db.insert("activity", {
        conferenceId: thread.conferenceId,
        kind: "reply_received",
        sponsor: "agentmail",
        durationMs: 0,
        summary: `Reply received from ${normalizeAddress(args.fromAddress)}`,
      });
    }

    return { stored: true, unmatched: thread === null, eventId };
  },
});
