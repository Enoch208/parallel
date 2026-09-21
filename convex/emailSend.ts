import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  sendEmail,
  buildIdempotencyKey,
  subjectWithToken,
  planEmailBody,
  coverEmailBody,
} from "./model/agentmailClient";
import type {
  BriefDelivery,
  CoverDetail,
  Delivery,
  PlanTargets,
  SendOutcome,
  ThreadHandle,
} from "./emailSendWrites";

const dailySendBudget = 80;

function requireKey(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set on this deployment`);
  }

  return value;
}

async function deliver(
  ctx: ActionCtx,
  delivery: Delivery,
  usedToday: number,
): Promise<SendOutcome> {
  if (usedToday >= dailySendBudget) {
    return {
      email: delivery.email,
      status: "budget_exhausted",
      detail: `${String(usedToday)} sends already used today, the budget is ${String(dailySendBudget)}`,
    };
  }

  const thread: ThreadHandle = await ctx.runMutation(internal.emailSendWrites.ensureThread, {
    conferenceId: delivery.conferenceId,
    membershipId: delivery.membershipId,
  });
  const startedAt = Date.now();

  const sent = await sendEmail({
    inboxId: requireKey("AGENTMAIL_INBOX"),
    to: [delivery.email],
    subject: subjectWithToken(delivery.headline, thread.token),
    text: delivery.text,
    apiKey: requireKey("AGENTMAIL_API_KEY"),
  });
  const durationMs = Date.now() - startedAt;

  await ctx.runMutation(internal.emailSendWrites.recordSend, {
    conferenceId: delivery.conferenceId,
    membershipId: delivery.membershipId,
    kind: delivery.kind,
    planRevision: delivery.planRevision,
    idempotencyKey: delivery.idempotencyKey,
    providerMessageId: sent.messageId,
    providerThreadId: sent.threadId,
    threadRowId: thread.threadRowId,
  });

  await ctx.runMutation(internal.importWrites.recordActivity, {
    conferenceId: delivery.conferenceId,
    kind: `${delivery.kind}_email_sent`,
    sponsor: "agentmail",
    durationMs,
    summary: `${delivery.summary}, token PL-${thread.token}`,
  });

  return { email: delivery.email, status: "sent", detail: sent.messageId };
}

export const sendPlanEmails = action({
  args: { conferenceId: v.id("conferences") },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number; skipped: number; failed: number; outcomes: SendOutcome[] }> => {
    const loaded: PlanTargets | null = await ctx.runQuery(internal.emailSendWrites.planTargets, {
      conferenceId: args.conferenceId,
    });

    if (loaded === null) {
      throw new Error("That conference has no computed plan to email");
    }

    const outcomes: SendOutcome[] = [];

    for (const target of loaded.targets) {
      const idempotencyKey = buildIdempotencyKey("plan", target.membershipId, loaded.planRevision);
      const gate = await ctx.runQuery(internal.emailSendWrites.sendGate, {
        conferenceId: args.conferenceId,
        idempotencyKey,
      });

      if (gate.alreadySent !== null) {
        outcomes.push({ email: target.email, status: "skipped", detail: gate.alreadySent });
        continue;
      }

      const delivery: Delivery = {
        conferenceId: args.conferenceId,
        membershipId: target.membershipId,
        kind: "plan",
        planRevision: loaded.planRevision,
        idempotencyKey,
        email: target.email,
        headline: `Your ${loaded.conferenceName} plan`,
        text: planEmailBody({
          displayName: target.displayName,
          conferenceName: loaded.conferenceName,
          timezone: loaded.timezone,
          sessions: target.sessions,
        }),
        summary: `Plan email to ${target.displayName} with ${String(target.sessions.length)} sessions`,
      };

      try {
        outcomes.push(await deliver(ctx, delivery, gate.usedToday));
      } catch (error) {
        outcomes.push({
          email: target.email,
          status: "failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      sent: outcomes.filter((outcome) => outcome.status === "sent").length,
      skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
      outcomes,
    };
  },
});

export const sendCoverRequest = action({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args): Promise<SendOutcome> => {
    const detail: CoverDetail | null = await ctx.runQuery(internal.emailSendWrites.coverDetail, {
      requestId: args.requestId,
    });

    if (detail === null) {
      throw new Error("That cover request no longer resolves to a teammate and a session");
    }

    const idempotencyKey = buildIdempotencyKey(
      "cover_request",
      detail.membershipId,
      detail.planRevision,
      args.requestId,
    );
    const gate = await ctx.runQuery(internal.emailSendWrites.sendGate, {
      conferenceId: detail.conferenceId,
      idempotencyKey,
    });

    if (gate.alreadySent !== null) {
      await ctx.runMutation(api.cover.markAsked, { requestId: args.requestId });
      return { email: detail.email, status: "skipped", detail: gate.alreadySent };
    }

    const outcome = await deliver(
      ctx,
      {
        conferenceId: detail.conferenceId,
        membershipId: detail.membershipId,
        kind: "cover_request",
        planRevision: detail.planRevision,
        idempotencyKey,
        email: detail.email,
        headline: `Can you cover "${detail.sessionTitle}"?`,
        text: coverEmailBody({
          displayName: detail.displayName,
          droppedBy: detail.droppedBy,
          sessionTitle: detail.sessionTitle,
          startsAt: detail.startsAt,
          endsAt: detail.endsAt,
          room: detail.room,
          timezone: detail.timezone,
          reasons: detail.reasons,
        }),
        summary: `Asked ${detail.displayName} to cover "${detail.sessionTitle}"`,
      },
      gate.usedToday,
    );

    if (outcome.status === "sent") {
      await ctx.runMutation(api.cover.markAsked, { requestId: args.requestId });
    }

    return outcome;
  },
});

export const sendBrief = action({
  args: { briefId: v.id("briefs") },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number; skipped: number; outcomes: SendOutcome[] }> => {
    const brief: BriefDelivery | null = await ctx.runQuery(internal.emailSendWrites.briefDelivery, {
      briefId: args.briefId,
    });

    if (brief === null) {
      throw new Error("That brief no longer exists");
    }

    if (brief.recipients.length === 0) {
      throw new Error("Add at least one recipient before sending the brief");
    }

    const outcomes: SendOutcome[] = [];

    for (const recipient of brief.recipients) {
      const idempotencyKey = `brief:${args.briefId}:${recipient.toLowerCase()}`;
      const gate = await ctx.runQuery(internal.emailSendWrites.sendGate, {
        conferenceId: brief.conferenceId,
        idempotencyKey,
      });

      if (gate.alreadySent !== null) {
        outcomes.push({ email: recipient, status: "skipped", detail: gate.alreadySent });
        continue;
      }

      if (gate.usedToday >= dailySendBudget) {
        outcomes.push({
          email: recipient,
          status: "budget_exhausted",
          detail: `${String(gate.usedToday)} sends already used today, the budget is ${String(dailySendBudget)}`,
        });
        continue;
      }

      const startedAt = Date.now();
      const delivered = await sendEmail({
        inboxId: requireKey("AGENTMAIL_INBOX"),
        to: [recipient],
        subject: `${brief.conferenceName}: what the team brought back`,
        text: brief.body,
        apiKey: requireKey("AGENTMAIL_API_KEY"),
      });

      await ctx.runMutation(internal.emailSendWrites.recordBriefSend, {
        conferenceId: brief.conferenceId,
        idempotencyKey,
        providerMessageId: delivered.messageId,
      });
      await ctx.runMutation(internal.importWrites.recordActivity, {
        conferenceId: brief.conferenceId,
        kind: "brief_email_sent",
        sponsor: "agentmail",
        durationMs: Date.now() - startedAt,
        summary: `Brief delivered to ${recipient}`,
      });

      outcomes.push({ email: recipient, status: "sent", detail: delivered.messageId });
    }

    const reached = outcomes.filter(
      (outcome) => outcome.status === "sent" || outcome.status === "skipped",
    );

    if (reached.length > 0) {
      await ctx.runMutation(internal.emailSendWrites.stampBriefSent, { briefId: args.briefId });
    }

    return {
      sent: outcomes.filter((outcome) => outcome.status === "sent").length,
      skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
      outcomes,
    };
  },
});
