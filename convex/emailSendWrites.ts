import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { type PlanEmailSession } from "./model/agentmailClient";
import { makeToken } from "./model/threadRouting";
import { startOfLocalDay } from "./model/zonedTime";

export interface PlanTarget {
  membershipId: Id<"memberships">;
  email: string;
  displayName: string;
  sessions: PlanEmailSession[];
}

export interface PlanTargets {
  conferenceName: string;
  timezone: string;
  planRevision: number;
  targets: PlanTarget[];
}

export interface CoverDetail {
  conferenceId: Id<"conferences">;
  timezone: string;
  planRevision: number;
  membershipId: Id<"memberships">;
  email: string;
  displayName: string;
  droppedBy: string;
  sessionTitle: string;
  startsAt: number;
  endsAt: number;
  room: string | null;
  reasons: string[];
}

export interface ThreadHandle {
  threadRowId: Id<"emailThreads">;
  token: string;
}

export interface SendOutcome {
  email: string;
  status: "sent" | "skipped" | "failed" | "budget_exhausted";
  detail: string | null;
}

export interface Delivery {
  conferenceId: Id<"conferences">;
  membershipId: Id<"memberships">;
  kind: string;
  planRevision: number;
  idempotencyKey: string;
  email: string;
  headline: string;
  text: string;
  summary: string;
}

async function freeToken(ctx: MutationCtx, membershipId: Id<"memberships">): Promise<string> {
  let seed = 7;

  for (const char of membershipId) {
    seed = (seed * 31 + char.charCodeAt(0)) % 2147483647;
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const token = makeToken(seed + attempt * 101);
    const taken = await ctx.db
      .query("emailThreads")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (taken === null) {
      return token;
    }
  }

  throw new Error("Could not allocate a free routing token");
}

export const planTargets = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<PlanTargets | null> => {
    const conference = await ctx.db.get(args.conferenceId);
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    if (conference === null || plan === null) {
      return null;
    }

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();
    const byMember = new Map<Id<"memberships">, PlanEmailSession[]>();

    for (const assignment of assignments) {
      const session = await ctx.db.get(assignment.sessionId);

      if (session === null) {
        continue;
      }

      const lines = byMember.get(assignment.membershipId) ?? [];
      lines.push({
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        room: session.room,
        reason: assignment.reason,
      });
      byMember.set(assignment.membershipId, lines);
    }

    const targets: PlanTarget[] = [];

    for (const [membershipId, sessions] of byMember) {
      const member = await ctx.db.get(membershipId);

      if (member !== null) {
        targets.push({
          membershipId,
          email: member.email,
          displayName: member.displayName,
          sessions: sessions.sort((left, right) => left.startsAt - right.startsAt),
        });
      }
    }

    return {
      conferenceName: conference.name,
      timezone: conference.timezone,
      planRevision: plan.computedAtRevision,
      targets,
    };
  },
});

export const coverDetail = internalQuery({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args): Promise<CoverDetail | null> => {
    const request = await ctx.db.get(args.requestId);

    if (request === null) {
      return null;
    }

    const conference = await ctx.db.get(request.conferenceId);
    const plan = await ctx.db.get(request.planId);
    const session = await ctx.db.get(request.sessionId);
    const member = await ctx.db.get(request.toMember);
    const dropped = await ctx.db.get(request.fromMember);

    if (conference === null || plan === null || session === null) {
      return null;
    }

    if (member === null || dropped === null) {
      return null;
    }

    return {
      conferenceId: request.conferenceId,
      timezone: conference.timezone,
      planRevision: plan.computedAtRevision,
      membershipId: request.toMember,
      email: member.email,
      displayName: member.displayName,
      droppedBy: dropped.displayName,
      sessionTitle: session.title,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      room: session.room,
      reasons: [...request.reasons],
    };
  },
});

export const sendGate = internalQuery({
  args: { conferenceId: v.id("conferences"), idempotencyKey: v.string() },
  handler: async (ctx, args): Promise<{ alreadySent: string | null; usedToday: number }> => {
    const existing = await ctx.db
      .query("outboundSends")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    const conference = await ctx.db.get(args.conferenceId);
    const timeZone = conference === null ? "UTC" : conference.timezone;
    const since = startOfLocalDay(Date.now(), timeZone);
    const rows = await ctx.db
      .query("outboundSends")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    return {
      alreadySent: existing === null ? null : (existing.providerMessageId ?? "recorded"),
      usedToday: rows.filter((row) => row.sentAt >= since).length,
    };
  },
});

export const ensureThread = internalMutation({
  args: { conferenceId: v.id("conferences"), membershipId: v.id("memberships") },
  handler: async (ctx, args): Promise<ThreadHandle> => {
    const threads = await ctx.db
      .query("emailThreads")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();
    const existing = threads.find((thread) => thread.membershipId === args.membershipId);

    if (existing !== undefined) {
      return { threadRowId: existing._id, token: existing.token };
    }

    const token = await freeToken(ctx, args.membershipId);
    const threadRowId = await ctx.db.insert("emailThreads", {
      conferenceId: args.conferenceId,
      membershipId: args.membershipId,
      providerThreadId: null,
      token,
    });

    return { threadRowId, token };
  },
});

export const recordSend = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.union(v.id("memberships"), v.null()),
    kind: v.string(),
    planRevision: v.number(),
    idempotencyKey: v.string(),
    providerMessageId: v.string(),
    providerThreadId: v.string(),
    threadRowId: v.id("emailThreads"),
  },
  handler: async (ctx, args): Promise<{ recorded: boolean }> => {
    const existing = await ctx.db
      .query("outboundSends")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (existing !== null) {
      return { recorded: false };
    }

    await ctx.db.insert("outboundSends", {
      conferenceId: args.conferenceId,
      membershipId: args.membershipId,
      kind: args.kind,
      planRevision: args.planRevision,
      idempotencyKey: args.idempotencyKey,
      providerMessageId: args.providerMessageId,
      sentAt: Date.now(),
    });

    const thread = await ctx.db.get(args.threadRowId);

    if (thread !== null && thread.providerThreadId === null) {
      await ctx.db.patch(args.threadRowId, { providerThreadId: args.providerThreadId });
    }

    return { recorded: true };
  },
});

export interface BriefDelivery {
  readonly conferenceId: Id<"conferences">;
  readonly conferenceName: string;
  readonly body: string;
  readonly recipients: readonly string[];
  readonly sentAt: number | null;
}

export const briefDelivery = internalQuery({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, args): Promise<BriefDelivery | null> => {
    const brief = await ctx.db.get(args.briefId);

    if (brief === null) {
      return null;
    }

    const conference = await ctx.db.get(brief.conferenceId);

    if (conference === null) {
      return null;
    }

    return {
      conferenceId: brief.conferenceId,
      conferenceName: conference.name,
      body: brief.body,
      recipients: brief.recipients,
      sentAt: brief.sentAt,
    };
  },
});

export const recordBriefSend = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    idempotencyKey: v.string(),
    providerMessageId: v.string(),
  },
  handler: async (ctx, args): Promise<{ recorded: boolean }> => {
    const existing = await ctx.db
      .query("outboundSends")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (existing !== null) {
      return { recorded: false };
    }

    await ctx.db.insert("outboundSends", {
      conferenceId: args.conferenceId,
      membershipId: null,
      kind: "brief",
      planRevision: 0,
      idempotencyKey: args.idempotencyKey,
      providerMessageId: args.providerMessageId,
      sentAt: Date.now(),
    });

    return { recorded: true };
  },
});

export const stampBriefSent = internalMutation({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, args): Promise<{ sentAt: number }> => {
    const brief = await ctx.db.get(args.briefId);

    if (brief === null) {
      throw new Error("Brief not found");
    }

    if (brief.sentAt !== null) {
      return { sentAt: brief.sentAt };
    }

    const sentAt = Date.now();
    await ctx.db.patch(args.briefId, { sentAt });
    return { sentAt };
  },
});
