import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { parseReply, shouldApplyAutomatically } from "./model/replySchema";

export interface ReliabilityProof {
  readonly name: string;
  readonly claim: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly durationMs: number;
}

export const forgetProofEvent = internalMutation({
  args: { providerEventId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("emailEvents")
      .withIndex("by_provider_event", (q) => q.eq("providerEventId", args.providerEventId))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { removed: rows.length };
  },
});

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "The call failed with no message";
}

async function proveDuplicateWebhook(ctx: ActionCtx): Promise<ReliabilityProof> {
  const startedAt = Date.now();
  const providerEventId = `reliability-proof-${String(startedAt)}-${Math.random().toString(36).slice(2)}`;
  const delivery = {
    providerEventId,
    kind: "reply",
    fromAddress: "proof@example.test",
    subject: "Reliability proof",
    body: "Reliability proof",
    providerThreadId: null,
  };

  try {
    const first = await ctx.runMutation(internal.emailIngest.recordInbound, delivery);
    const second = await ctx.runMutation(internal.emailIngest.recordInbound, delivery);
    const passed = first.stored && !second.stored;

    return {
      name: "Duplicate webhook",
      claim: "The same provider event delivered twice is stored once",
      passed,
      detail: passed
        ? "Second delivery of the same event id was recognised and dropped"
        : `First stored: ${String(first.stored)}, second stored: ${String(second.stored)}`,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await ctx.runMutation(internal.reliability.forgetProofEvent, { providerEventId });
  }
}

async function proveStaleWriteRefused(
  ctx: ActionCtx,
  conferenceId: Id<"conferences">,
): Promise<ReliabilityProof> {
  const startedAt = Date.now();
  const built = await ctx.runMutation(api.plan.optimize, { conferenceId });
  const plan = await ctx.runQuery(api.board.latestPlan, { conferenceId });
  const sessions = await ctx.runQuery(api.board.conferenceSessions, { conferenceId });
  const overview = await ctx.runQuery(api.board.conferenceOverview, { conferenceId });
  const session = sessions.at(0);
  const member = overview?.members.at(0);

  if (built.kind !== "plan" || plan === null || session === undefined || member === undefined) {
    return {
      name: "Stale browser write",
      claim: "A write made against an older plan revision is refused",
      passed: false,
      detail: "The throwaway workspace had no plan to write against",
      durationMs: Date.now() - startedAt,
    };
  }

  const revisionTheBrowserSaw = plan.conferenceRevision;
  await ctx.runMutation(api.team.setPreference, {
    conferenceId,
    membershipId: member.id as Id<"memberships">,
    sessionId: session.id as Id<"sessions">,
    stance: "interested",
  });
  await ctx.runMutation(api.plan.optimize, { conferenceId });
  const moved = await ctx.runQuery(api.board.latestPlan, { conferenceId });
  const currentRevision = moved === null ? revisionTheBrowserSaw : moved.conferenceRevision;
  const currentPlanId = moved === null ? plan.id : moved.id;

  try {
    await ctx.runMutation(api.assignments.claim, {
      planId: currentPlanId as Id<"plans">,
      sessionId: session.id as Id<"sessions">,
      membershipId: member.id as Id<"memberships">,
      expectedRevision: revisionTheBrowserSaw,
    });

    return {
      name: "Stale browser write",
      claim: "A write made against an older plan revision is refused",
      passed: false,
      detail: "A write against an old revision was accepted",
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = describe(error);
    const passed = message.includes("changed while you were looking");
    const reason = message.slice(Math.max(0, message.indexOf("The plan"))).split("\n")[0] ?? "";

    return {
      name: "Stale browser write",
      claim: "A write made against an older plan revision is refused",
      passed,
      detail: passed
        ? `A browser holding revision ${String(revisionTheBrowserSaw)} wrote after the plan moved to ${String(currentRevision)}, and was told: "${reason}"`
        : (message.split("\n")[0] ?? message),
      durationMs: Date.now() - startedAt,
    };
  }
}

function proveQuoteMustBeVerbatim(): ReliabilityProof {
  const startedAt = Date.now();
  const body = "Sorry, I cannot make the 2pm session, a customer lunch ran over.";
  const reading = {
    intent: "cant_attend",
    sessionHint: null,
    timeHint: "2pm",
    confidence: 0.99,
  };
  const paraphrased = parseReply(
    { ...reading, quote: "I will be missing the afternoon talk" },
    body,
  );
  const verbatim = parseReply({ ...reading, quote: "I cannot make the 2pm session" }, body);
  const passed =
    !paraphrased.quoteVerified && !shouldApplyAutomatically(paraphrased) && verbatim.quoteVerified;

  return {
    name: "Invented evidence",
    claim: "A model quote that is not in the email is never acted on",
    passed,
    detail: passed
      ? "A paraphrase at 0.99 confidence was refused; the same reading quoting the email word for word was accepted"
      : `Paraphrase verified: ${String(paraphrased.quoteVerified)}, verbatim verified: ${String(verbatim.quoteVerified)}`,
    durationMs: Date.now() - startedAt,
  };
}

async function proveSendIsIdempotent(
  ctx: ActionCtx,
  conferenceId: Id<"conferences">,
): Promise<ReliabilityProof> {
  const startedAt = Date.now();
  const idempotencyKey = `reliability-proof:${conferenceId}:${String(startedAt)}`;
  const record = {
    conferenceId,
    idempotencyKey,
    providerMessageId: "reliability-proof-message",
  };
  const first = await ctx.runMutation(internal.emailSendWrites.recordBriefSend, record);
  const second = await ctx.runMutation(internal.emailSendWrites.recordBriefSend, record);
  const gate = await ctx.runQuery(internal.emailSendWrites.sendGate, {
    conferenceId,
    idempotencyKey,
  });
  const passed = first.recorded && !second.recorded && gate.alreadySent !== null;

  return {
    name: "Repeated send",
    claim: "Retrying a send never delivers the same email twice",
    passed,
    detail: passed
      ? "The retry found the first send in the ledger and stopped before contacting the provider"
      : `First recorded: ${String(first.recorded)}, second recorded: ${String(second.recorded)}`,
    durationMs: Date.now() - startedAt,
  };
}

export const runReliabilityProofs = action({
  args: {},
  handler: async (ctx): Promise<ReliabilityProof[]> => {
    const conferenceId = await ctx.runMutation(api.demo.seedDemoWorkspace, {});

    try {
      return [
        await proveDuplicateWebhook(ctx),
        await proveStaleWriteRefused(ctx, conferenceId),
        proveQuoteMustBeVerbatim(),
        await proveSendIsIdempotent(ctx, conferenceId),
      ];
    } finally {
      await ctx.runMutation(internal.guest.removeConference, { conferenceId });
    }
  },
});
