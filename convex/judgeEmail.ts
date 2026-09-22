import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  hashJudgeToken,
  judgeSubjectTag,
  judgeTokenLifetimeMs,
  mintJudgeToken,
} from "./model/judgeToken";

export interface JudgeEmail {
  readonly address: string;
  readonly subject: string;
  readonly body: string;
  readonly memberName: string;
  readonly sessionTitle: string;
  readonly expiresInMinutes: number;
}

export type JudgeEmailState = "waiting" | "reading" | "applied" | "unplaced" | "failed" | "expired";

export interface JudgeEmailStatus {
  readonly state: JudgeEmailState;
  readonly detail: string | null;
}

export const judgeEmailTarget = internalQuery({
  args: {
    conferenceId: v.id("conferences"),
    excludeMembershipId: v.union(v.id("memberships"), v.null()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    if (plan === null) {
      return null;
    }

    const [assignments, sessions] = await Promise.all([
      ctx.db
        .query("assignments")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
    ]);

    const titleCounts = new Map<string, number>();

    for (const session of sessions) {
      titleCounts.set(session.title, (titleCounts.get(session.title) ?? 0) + 1);
    }

    const order = new Map(sessions.map((session, index) => [session._id as string, index]));
    const ordered = [...assignments].sort(
      (a, b) => (order.get(a.sessionId) ?? 0) - (order.get(b.sessionId) ?? 0),
    );

    for (const assignment of ordered) {
      const session = sessions.find((row) => row._id === assignment.sessionId);

      if (
        assignment.membershipId === args.excludeMembershipId ||
        session === undefined ||
        session.cancelledAt !== undefined ||
        titleCounts.get(session.title) !== 1
      ) {
        continue;
      }

      const member = await ctx.db.get(assignment.membershipId);

      if (member !== null) {
        return {
          membershipId: member._id,
          memberName: member.displayName,
          sessionTitle: session.title,
        };
      }
    }

    return null;
  },
});

export const storeJudgeToken = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null || !conference.isDemoData || conference.frozen === true) {
      throw new Error("A judge token can only be issued for a demo workspace");
    }

    const member = await ctx.db.get(args.membershipId);

    if (member === null || member.teamId !== conference.teamId) {
      throw new Error("A judge token must name a teammate of that demo workspace");
    }

    return ctx.db.insert("judgeTokens", args);
  },
});

export const judgeEmailStatus = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<JudgeEmailStatus> => {
    const events = await ctx.db
      .query("emailEvents")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();
    const latest = events.filter((event) => event.judgeTokenId !== undefined).at(-1);

    if (latest !== undefined) {
      if (latest.handled) {
        return { state: "applied", detail: null };
      }

      if (latest.parseState === "queued") {
        return { state: "reading", detail: null };
      }

      if (latest.parseState === "failed") {
        return { state: "failed", detail: latest.parseFailure ?? null };
      }

      return {
        state: "unplaced",
        detail: latest.intent === null ? null : `Read as ${latest.intent}`,
      };
    }

    const tokens = await ctx.db
      .query("judgeTokens")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();
    const live = tokens.some(
      (token) => token.revokedAt === undefined && token.expiresAt > Date.now(),
    );

    return { state: live ? "waiting" : "expired", detail: null };
  },
});

export async function issueJudgeEmail(
  ctx: ActionCtx,
  conferenceId: Id<"conferences">,
  excludeMembershipId: Id<"memberships"> | null,
): Promise<JudgeEmail | null> {
  const address = process.env.AGENTMAIL_INBOX;

  if (address === undefined || address.length === 0) {
    return null;
  }

  const target = await ctx.runQuery(internal.judgeEmail.judgeEmailTarget, {
    conferenceId,
    excludeMembershipId,
  });

  if (target === null) {
    return null;
  }

  const token = mintJudgeToken();

  await ctx.runMutation(internal.judgeEmail.storeJudgeToken, {
    conferenceId,
    membershipId: target.membershipId,
    tokenHash: await hashJudgeToken(token),
    expiresAt: Date.now() + judgeTokenLifetimeMs,
  });

  return {
    address,
    subject: `${judgeSubjectTag(token)} I can't make a session`,
    body: `I can't make "${target.sessionTitle}" any more, something came up.`,
    memberName: target.memberName,
    sessionTitle: target.sessionTitle,
    expiresInMinutes: judgeTokenLifetimeMs / 60_000,
  };
}
