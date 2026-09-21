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
import {
  applyCoverAcceptance,
  declineCoverRequest,
  openCoverRequestsFor,
} from "./model/coverAcceptance";

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

    const open = await openCoverRequestsFor(ctx, event.conferenceId, event.membershipId);

    if (open.length === 0) {
      return { handled: false, reason: "no_open_request" as const };
    }

    if (open.length > 1) {
      return { handled: false, reason: "ambiguous_request" as const };
    }

    const mine = open.at(0);

    if (mine === undefined) {
      return { handled: false, reason: "no_open_request" as const };
    }

    if (!args.accept) {
      const declined = await declineCoverRequest(ctx, mine._id);

      if (!declined.declined) {
        return { handled: false, reason: "no_open_request" as const };
      }

      await ctx.db.patch(args.eventId, { handled: true });
      return { handled: true, reason: "declined" as const, requestId: mine._id };
    }

    const outcome = await applyCoverAcceptance(ctx, mine._id, null, "email");

    if (!outcome.accepted) {
      return { handled: false, reason: outcome.reason, detail: outcome.detail };
    }

    await ctx.db.patch(args.eventId, { handled: true });
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
    body: v.string(),
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

    if (args.intent === "pin") {
      const conferenceId = event.conferenceId;
      const membershipId = event.membershipId;
      const existing = await ctx.db
        .query("memberPreferences")
        .withIndex("by_member", (q) =>
          q.eq("conferenceId", conferenceId).eq("membershipId", membershipId),
        )
        .collect();
      const current = existing.find((row) => row.sessionId === args.sessionId);

      if (current === undefined) {
        await ctx.db.insert("memberPreferences", {
          conferenceId: event.conferenceId,
          membershipId: event.membershipId,
          sessionId: args.sessionId,
          stance: "pinned",
        });
      } else {
        await ctx.db.patch(current._id, { stance: "pinned" });
      }

      const pinRevision = await bumpConstraintRevision(ctx, event.conferenceId);

      await ctx.db.insert("activity", {
        conferenceId: event.conferenceId,
        kind: "constraint_added",
        sponsor: "openai",
        durationMs: 0,
        summary: `Reply parsed as a request to pin "${session.title}"`,
      });

      return { applied: true, reason: null, constraintRevision: pinRevision };
    }

    if (args.intent === "takeaways") {
      const author = await ctx.db.get(event.membershipId);

      await ctx.db.insert("notes", {
        conferenceId: event.conferenceId,
        sessionId: args.sessionId,
        membershipId: event.membershipId,
        body: args.body.trim(),
        source: "email",
      });

      await ctx.db.insert("activity", {
        conferenceId: event.conferenceId,
        kind: "note_added",
        sponsor: "agentmail",
        durationMs: 0,
        summary:
          author === null
            ? `Takeaway received for "${session.title}"`
            : `Takeaway from ${author.displayName} on "${session.title}"`,
      });

      return { applied: true, reason: null };
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

    const namesASession =
      parsed.intent === "cant_attend" || parsed.intent === "takeaways" || parsed.intent === "pin";

    if (namesASession) {
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

    const applied = namesASession && shouldApplyAutomatically(parsed) && sessionId !== null;

    const outcome = await ctx.runMutation(internal.emailReplies.applyParsedReply, {
      eventId: args.eventId,
      intent: parsed.intent,
      confidence: parsed.confidence,
      quote: parsed.quote,
      sessionId,
      body: context.body,
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
