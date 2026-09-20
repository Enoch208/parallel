import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { structuredOutput, extractionModel } from "./model/openaiClient";
import {
  parseReply,
  replyExtractionSchema,
  replySystemPrompt,
  shouldApplyAutomatically,
} from "./model/replySchema";
import { matchSessionByTime, matchSessionByTitle } from "./model/sessionMatch";
import { bumpConstraintRevision } from "./constraints";

export const pendingReplies = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) =>
    ctx.db
      .query("emailEvents")
      .withIndex("by_conference_handled", (q) =>
        q.eq("conferenceId", args.conferenceId).eq("handled", false),
      )
      .collect(),
});

export const loadReplyContext = internalQuery({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.membershipId === null) {
      return null;
    }

    const conferenceId = event.conferenceId;
    const conference = await ctx.db.get(conferenceId);

    if (conference === null) {
      return null;
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_conference_start", (q) => q.eq("conferenceId", conferenceId))
      .collect();

    return {
      body: event.body,
      conferenceId,
      membershipId: event.membershipId,
      timezone: conference.timezone,
      sessions: sessions.map((session) => ({
        id: session._id,
        title: session.title,
        track: session.track,
        room: session.room,
        speakers: session.speakers,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        sourceUrl: conference.agendaUrl,
        titleConfidence: session.titleConfidence,
        timeConfidence: session.timeConfidence,
        roomConfidence: session.roomConfidence,
      })),
    };
  },
});

export const resolveCoverReply = internalMutation({
  args: {
    eventId: v.id("emailEvents"),
    accept: v.boolean(),
    intent: v.string(),
    confidence: v.number(),
    quote: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.membershipId === null) {
      return { handled: false, reason: "unmatched" as const };
    }

    await ctx.db.patch(args.eventId, {
      intent: args.intent,
      confidence: args.confidence,
      quote: args.quote,
    });

    const conferenceId = event.conferenceId;
    const membershipId = event.membershipId;

    const open = await ctx.db
      .query("coverRequests")
      .withIndex("by_conference_status", (q) =>
        q.eq("conferenceId", conferenceId).eq("status", "asked"),
      )
      .collect();

    const mine = open.find((request) => request.toMember === membershipId);

    if (mine === undefined) {
      return { handled: false, reason: "no_open_request" as const };
    }

    if (!args.accept) {
      await ctx.db.patch(mine._id, { status: "declined" });
      await ctx.db.patch(args.eventId, { handled: true });
      return { handled: true, reason: "declined" as const, requestId: mine._id };
    }

    const session = await ctx.db.get(mine.sessionId);
    const member = await ctx.db.get(membershipId);

    if (session === null || member === null) {
      return { handled: false, reason: "missing_records" as const };
    }

    await ctx.db.insert("assignments", {
      planId: mine.planId,
      conferenceId,
      sessionId: mine.sessionId,
      membershipId,
      pinned: false,
      reason: `Covering after a teammate dropped out, +${mine.coverageGain.toFixed(1)} Team Goal Coverage`,
    });

    await ctx.db.patch(mine._id, { status: "accepted" });
    await ctx.db.patch(args.eventId, { handled: true });
    await bumpConstraintRevision(ctx, conferenceId);

    await ctx.db.insert("activity", {
      conferenceId,
      kind: "cover_accepted",
      sponsor: "agentmail",
      durationMs: 0,
      summary: `${member.displayName} replied YES and now covers "${session.title}". 1 person moved.`,
    });

    return { handled: true, reason: "accepted" as const, requestId: mine._id };
  },
});

export const applyParsedReply = internalMutation({
  args: {
    eventId: v.id("emailEvents"),
    intent: v.string(),
    confidence: v.number(),
    quote: v.union(v.string(), v.null()),
    sessionId: v.union(v.id("sessions"), v.null()),
    applied: v.boolean(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.membershipId === null) {
      return { applied: false, reason: "unmatched" as const };
    }

    await ctx.db.patch(args.eventId, {
      intent: args.intent,
      confidence: args.confidence,
      quote: args.quote,
      handled: args.applied,
    });

    if (!args.applied || args.sessionId === null) {
      return { applied: false, reason: "needs_confirmation" as const };
    }

    const session = await ctx.db.get(args.sessionId);

    if (session === null) {
      return { applied: false, reason: "unknown_session" as const };
    }

    await ctx.db.insert("availabilityBlocks", {
      conferenceId: event.conferenceId,
      membershipId: event.membershipId,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      reason: "Replied that they cannot attend",
      sourceQuote: args.quote,
    });

    const revision = await bumpConstraintRevision(ctx, event.conferenceId);

    await ctx.db.insert("activity", {
      conferenceId: event.conferenceId,
      kind: "constraint_added",
      sponsor: "openai",
      durationMs: 0,
      summary: `Reply parsed as cannot attend "${session.title}"`,
    });

    return { applied: true, reason: null, constraintRevision: revision };
  },
});

export interface ParseAndApplyResult {
  readonly applied: boolean;
  readonly intent: string | null;
  readonly confidence?: number;
  readonly quoteVerified?: boolean;
  readonly matchedSession?: Id<"sessions"> | null;
  readonly reason: string | null;
}

export const parseAndApply = action({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args): Promise<ParseAndApplyResult> => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error("OPENAI_API_KEY is not set on this deployment");
    }

    const context = await ctx.runQuery(internal.emailReplies.loadReplyContext, {
      eventId: args.eventId,
    });

    if (context === null) {
      return { applied: false, intent: null, reason: "unmatched" as const };
    }

    const raw = await structuredOutput({
      model: extractionModel,
      system: replySystemPrompt,
      user: context.body,
      schemaName: "reply",
      schema: replyExtractionSchema,
      apiKey,
    });

    const parsed = parseReply(raw, context.body);

    if (parsed.intent === "yes" || parsed.intent === "no") {
      const outcome = await ctx.runMutation(internal.emailReplies.resolveCoverReply, {
        eventId: args.eventId,
        accept: parsed.intent === "yes",
        intent: parsed.intent,
        confidence: parsed.confidence,
        quote: parsed.quote,
      });

      return {
        applied: outcome.handled,
        intent: parsed.intent,
        confidence: parsed.confidence,
        quoteVerified: parsed.quoteVerified,
        matchedSession: null,
        reason: outcome.reason,
      };
    }

    let sessionId: Id<"sessions"> | null = null;

    if (parsed.intent === "cant_attend") {
      const byTime =
        parsed.timeHint === null
          ? null
          : matchSessionByTime(context.sessions, parsed.timeHint, context.timezone);
      const byTitle =
        parsed.sessionHint === null
          ? null
          : matchSessionByTitle(context.sessions, parsed.sessionHint);
      const chosen = byTime ?? byTitle;
      sessionId = chosen === null ? null : (chosen.id as Id<"sessions">);
    }

    const applied =
      parsed.intent === "cant_attend" && shouldApplyAutomatically(parsed) && sessionId !== null;

    const outcome = await ctx.runMutation(internal.emailReplies.applyParsedReply, {
      eventId: args.eventId,
      intent: parsed.intent,
      confidence: parsed.confidence,
      quote: parsed.quote,
      sessionId,
      applied,
    });

    return {
      applied: outcome.applied,
      intent: parsed.intent,
      confidence: parsed.confidence,
      quoteVerified: parsed.quoteVerified,
      matchedSession: sessionId,
      reason: outcome.reason,
    };
  },
});
