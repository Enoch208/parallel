import { ConvexError, v } from "convex/values";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { assertWritable } from "./model/frozenConference";
import { replyParseAttempts, replyRetrier } from "./model/replyRetrier";

export type QueueOutcome = "queued" | "already_queued" | "not_needed";

export async function queueReplyParse(
  ctx: MutationCtx,
  event: Doc<"emailEvents">,
  retryFailed: boolean,
): Promise<QueueOutcome> {
  if (event.conferenceId === null || event.membershipId === null || event.handled) {
    return "not_needed";
  }

  if (event.parseState === "queued") {
    return "already_queued";
  }

  if (event.parseState === "review" || (event.parseState === "failed" && !retryFailed)) {
    return "not_needed";
  }

  const runId = await replyRetrier.run(
    ctx,
    internal.emailReplies.parseAndApply,
    { eventId: event._id },
    { onComplete: internal.replyParsing.parseFinished },
  );

  await ctx.db.patch(event._id, {
    parseState: "queued",
    parseRunId: runId,
    parseFailure: undefined,
  });

  return "queued";
}

export const ensureParseQueued = internalMutation({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args): Promise<QueueOutcome> => {
    const event = await ctx.db.get(args.eventId);
    return event === null ? "not_needed" : queueReplyParse(ctx, event, false);
  },
});

export const parseFinished = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("emailEvents")
      .withIndex("by_parse_run", (q) => q.eq("parseRunId", args.runId))
      .first();

    if (event === null) {
      return { updated: false };
    }

    if (event.handled) {
      await ctx.db.patch(event._id, { parseState: undefined, parseFailure: undefined });
      return { updated: true };
    }

    if (args.result.type === "success") {
      await ctx.db.patch(event._id, { parseState: "review", parseFailure: undefined });
      return { updated: true };
    }

    const failure =
      args.result.type === "failed"
        ? `Reply parsing failed after ${String(replyParseAttempts)} attempts. Original email preserved.`
        : "Reply parsing was canceled. Original email preserved.";

    await ctx.db.patch(event._id, { parseState: "failed", parseFailure: failure });

    if (event.conferenceId !== null) {
      await ctx.db.insert("activity", {
        conferenceId: event.conferenceId,
        kind: "reply_parse_failed",
        sponsor: "openai",
        durationMs: 0,
        summary: `${failure} It is waiting on the Evidence screen.`,
      });
    }

    return { updated: true };
  },
});

export const retryReplyParsing = mutation({
  args: { eventId: v.id("emailEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (event === null || event.conferenceId === null || event.membershipId === null) {
      throw new ConvexError("That reply is not tied to a teammate on a conference");
    }

    await assertWritable(ctx, event.conferenceId);

    if (event.handled) {
      throw new ConvexError("That reply has already been applied");
    }

    if (event.judgeTokenId !== undefined) {
      throw new ConvexError("Send the email again instead; a judge's email is read once per send.");
    }

    if (event.parseState === "review") {
      throw new ConvexError(
        "That reply was read, but Parallel could not place it. Resolve it by hand instead.",
      );
    }

    const outcome = await queueReplyParse(ctx, event, true);
    return { queued: outcome !== "not_needed" };
  },
});
