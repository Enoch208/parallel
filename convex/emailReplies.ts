import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  extractionModel,
  isTransientProviderFailure,
  structuredOutput,
} from "./model/openaiClient";
import { replyRetrier } from "./model/replyRetrier";
import {
  parseReply,
  replyExtractionSchema,
  replySystemPrompt,
  shouldApplyAutomatically,
} from "./model/replySchema";
import { matchSessionByTime, matchSessionByTitle } from "./model/sessionMatch";
import { saysMoreThanTheTitle } from "./model/takeawaySubstance";
import { bumpConstraintRevision } from "./constraints";
import {
  applyCoverAcceptance,
  declineCoverRequest,
  openCoverRequestsFor,
} from "./model/coverAcceptance";
import { assertWritable, isFrozen } from "./model/frozenConference";

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
      handled: event.handled,
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

    if (event.handled) {
      return { handled: false, reason: "already_handled" as const };
    }

    if (await isFrozen(ctx, event.conferenceId)) {
      return { handled: false, reason: "frozen" as const };
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

interface ResolvedReply {
  readonly conferenceId: Id<"conferences">;
  readonly membershipId: Id<"memberships">;
  readonly intent: string;
  readonly sessionId: Id<"sessions">;
  readonly body: string;
  readonly quote: string | null;
  readonly origin: string;
}

async function applyReplyToSession(
  ctx: MutationCtx,
  reply: ResolvedReply,
): Promise<{ applied: boolean; reason: "unknown_session" | "empty_takeaway" | null }> {
  const session = await ctx.db.get(reply.sessionId);

  if (session === null) {
    return { applied: false, reason: "unknown_session" };
  }

  if (reply.intent === "takeaways" && !saysMoreThanTheTitle(reply.body, session.title)) {
    return { applied: false, reason: "empty_takeaway" };
  }

  if (reply.intent === "pin") {
    const existing = await ctx.db
      .query("memberPreferences")
      .withIndex("by_member", (q) =>
        q.eq("conferenceId", reply.conferenceId).eq("membershipId", reply.membershipId),
      )
      .collect();
    const current = existing.find((row) => row.sessionId === reply.sessionId);

    if (current === undefined) {
      await ctx.db.insert("memberPreferences", {
        conferenceId: reply.conferenceId,
        membershipId: reply.membershipId,
        sessionId: reply.sessionId,
        stance: "pinned",
      });
    } else {
      await ctx.db.patch(current._id, { stance: "pinned" });
    }

    await bumpConstraintRevision(ctx, reply.conferenceId);
    await ctx.db.insert("activity", {
      conferenceId: reply.conferenceId,
      kind: "constraint_added",
      sponsor: "openai",
      durationMs: 0,
      summary: `${reply.origin} as a request to pin "${session.title}"`,
    });

    return { applied: true, reason: null };
  }

  if (reply.intent === "takeaways") {
    const author = await ctx.db.get(reply.membershipId);

    await ctx.db.insert("notes", {
      conferenceId: reply.conferenceId,
      sessionId: reply.sessionId,
      membershipId: reply.membershipId,
      body: reply.body.trim(),
      source: "email",
    });
    await ctx.db.insert("activity", {
      conferenceId: reply.conferenceId,
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
    conferenceId: reply.conferenceId,
    membershipId: reply.membershipId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    reason: "Replied that they cannot attend",
    sourceQuote: reply.quote,
  });
  await bumpConstraintRevision(ctx, reply.conferenceId);
  await ctx.db.insert("activity", {
    conferenceId: reply.conferenceId,
    kind: "constraint_added",
    sponsor: "openai",
    durationMs: 0,
    summary: `${reply.origin} as cannot attend "${session.title}"`,
  });

  return { applied: true, reason: null };
}

export const resolveByHand = mutation({
  args: {
    eventId: v.id("emailEvents"),
    sessionId: v.id("sessions"),
    intent: v.union(v.literal("cant_attend"), v.literal("takeaways"), v.literal("pin")),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.membershipId === null) {
      throw new ConvexError("That reply is not tied to a teammate on a conference");
    }

    await assertWritable(ctx, event.conferenceId);

    if (event.handled) {
      throw new ConvexError("That reply has already been applied");
    }

    const session = await ctx.db.get(args.sessionId);

    if (session === null || session.conferenceId !== event.conferenceId) {
      throw new ConvexError("That session is not on this conference agenda");
    }

    const outcome = await applyReplyToSession(ctx, {
      conferenceId: event.conferenceId,
      membershipId: event.membershipId,
      intent: args.intent,
      sessionId: args.sessionId,
      body: event.body,
      quote: event.quote,
      origin: "Resolved by hand",
    });

    if (outcome.reason === "empty_takeaway") {
      throw new ConvexError(
        "That reply names the session but says nothing about it, so there is no takeaway to file",
      );
    }

    if (!outcome.applied) {
      throw new ConvexError("That session could not be resolved");
    }

    await ctx.db.patch(args.eventId, {
      handled: true,
      resolvedByHand: true,
      intent: args.intent,
    });

    return { applied: true };
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

    if (event.handled) {
      return { applied: false, reason: "already_handled" as const };
    }

    if (await isFrozen(ctx, event.conferenceId)) {
      return { applied: false, reason: "frozen" as const };
    }

    const parsed = { intent: args.intent, confidence: args.confidence, quote: args.quote };

    if (!args.applied || args.sessionId === null) {
      await ctx.db.patch(args.eventId, { ...parsed, handled: false });
      return { applied: false, reason: "needs_confirmation" as const };
    }

    const outcome = await applyReplyToSession(ctx, {
      conferenceId: event.conferenceId,
      membershipId: event.membershipId,
      intent: args.intent,
      sessionId: args.sessionId,
      body: args.body,
      quote: args.quote,
      origin: "Reply parsed",
    });

    await ctx.db.patch(args.eventId, { ...parsed, handled: outcome.applied });
    return outcome;
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

export const queueReplyParsing = internalMutation({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args): Promise<string> =>
    replyRetrier.run(ctx, internal.emailReplies.parseAndApply, { eventId: args.eventId }),
});

export const recordUnreadableReply = internalMutation({
  args: { eventId: v.id("emailEvents"), detail: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.handled) {
      return { recorded: false };
    }

    await ctx.db.insert("activity", {
      conferenceId: event.conferenceId,
      kind: "reply_unreadable",
      sponsor: "openai",
      durationMs: 0,
      summary: `A reply could not be read automatically (${args.detail}). It is waiting on the Evidence screen for a person.`,
    });

    return { recorded: true };
  },
});

async function readReply(
  body: string,
  apiKey: string,
): Promise<{ parsed: ReturnType<typeof parseReply> } | { unreadable: string }> {
  try {
    const raw = await structuredOutput({
      model: extractionModel,
      system: replySystemPrompt,
      user: body,
      schemaName: "reply",
      schema: replyExtractionSchema,
      apiKey,
    });
    return { parsed: parseReply(raw, body) };
  } catch (error) {
    if (isTransientProviderFailure(error)) {
      throw error;
    }

    return { unreadable: error instanceof Error ? error.message : "the model gave no answer" };
  }
}

export const parseAndApply = internalAction({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args): Promise<ParseAndApplyResult> => {
    const context = await ctx.runQuery(internal.emailReplies.loadReplyContext, {
      eventId: args.eventId,
    });

    if (context === null) {
      return { applied: false, intent: null, reason: "unmatched" as const };
    }

    if (context.handled) {
      return { applied: false, intent: null, reason: "already_handled" as const };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey === undefined || apiKey.length === 0) {
      await ctx.runMutation(internal.emailReplies.recordUnreadableReply, {
        eventId: args.eventId,
        detail: "OPENAI_API_KEY is not set on this deployment",
      });
      return { applied: false, intent: null, reason: "model_not_configured" as const };
    }

    const reading = await readReply(context.body, apiKey);

    if ("unreadable" in reading) {
      await ctx.runMutation(internal.emailReplies.recordUnreadableReply, {
        eventId: args.eventId,
        detail: reading.unreadable,
      });
      return { applied: false, intent: null, reason: "unreadable" as const };
    }

    const parsed = reading.parsed;

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
