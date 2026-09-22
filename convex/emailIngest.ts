import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeAddress, tokenFromSubject } from "./model/threadRouting";
import { queueReplyParse } from "./replyParsing";
import { rateLimiter } from "./model/rateLimits";

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

interface JudgeRoute extends RoutedThread {
  readonly tokenId: Id<"judgeTokens">;
  readonly limited: boolean;
}

const judgeLimitNotice =
  "Too many emails for this demo in ten minutes. This one was kept but not read; send it again in a few minutes.";

async function routeByJudgeToken(ctx: MutationCtx, tokenHash: string): Promise<JudgeRoute | null> {
  const token = await ctx.db
    .query("judgeTokens")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .first();

  if (token === null || token.revokedAt !== undefined || token.expiresAt <= Date.now()) {
    return null;
  }

  const conference = await ctx.db.get(token.conferenceId);

  if (conference === null || !conference.isDemoData || conference.frozen === true) {
    return null;
  }

  const allowance = await rateLimiter.limit(ctx, "judgeEmail", { key: token._id });

  return {
    conferenceId: token.conferenceId,
    membershipId: token.membershipId,
    tokenId: token._id,
    limited: !allowance.ok,
  };
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
    judgeTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("emailEvents")
      .withIndex("by_provider_event", (q) => q.eq("providerEventId", args.providerEventId))
      .first();

    if (duplicate !== null) {
      const repaired = await queueReplyParse(ctx, duplicate, false);
      return { stored: false, unmatched: false, eventId: null, queued: repaired === "queued" };
    }

    const routed = await routeToThread(ctx, args.providerThreadId, args.subject, args.fromAddress);
    const judge =
      routed === null && args.judgeTokenHash !== undefined
        ? await routeByJudgeToken(ctx, args.judgeTokenHash)
        : null;
    const thread: RoutedThread | null = routed ?? judge;

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
      ...(judge === null ? {} : { judgeTokenId: judge.tokenId }),
      ...(judge?.limited === true
        ? { parseState: "failed" as const, parseFailure: judgeLimitNotice }
        : {}),
    });

    if (thread !== null) {
      await ctx.db.insert("activity", {
        conferenceId: thread.conferenceId,
        kind: "reply_received",
        sponsor: "agentmail",
        durationMs: 0,
        summary:
          judge === null
            ? `Reply received from ${normalizeAddress(args.fromAddress)}`
            : "Reply received from a judge's own email",
      });
    }

    const stored = await ctx.db.get(eventId);
    const queued = stored === null ? "not_needed" : await queueReplyParse(ctx, stored, false);

    return { stored: true, unmatched: thread === null, eventId, queued: queued === "queued" };
  },
});
