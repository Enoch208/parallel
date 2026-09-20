import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const noteSource = v.union(v.literal("email"), v.literal("app"));

export interface TakeawayPrompt {
  readonly conferenceId: Id<"conferences">;
  readonly membershipId: Id<"memberships">;
  readonly displayName: string;
  readonly email: string;
  readonly sessionId: Id<"sessions">;
  readonly sessionTitle: string;
  readonly sessionEndedAt: number;
}

export const listForConference = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("notes")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .collect();

    return Promise.all(
      rows.map(async (row) => {
        const [session, member] = await Promise.all([
          ctx.db.get(row.sessionId),
          ctx.db.get(row.membershipId),
        ]);

        return {
          id: row._id,
          sessionId: row.sessionId,
          sessionTitle: session === null ? "Unknown session" : session.title,
          membershipId: row.membershipId,
          authorName: member === null ? "Unknown teammate" : member.displayName,
          body: row.body,
          source: row.source,
          at: row._creationTime,
        };
      }),
    );
  },
});

export const addNote = mutation({
  args: {
    conferenceId: v.id("conferences"),
    sessionId: v.id("sessions"),
    membershipId: v.id("memberships"),
    body: v.string(),
    source: noteSource,
  },
  handler: async (ctx, args) => {
    const body = args.body.trim();

    if (body.length === 0) {
      throw new Error("A takeaway needs some text");
    }

    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const session = await ctx.db.get(args.sessionId);

    if (session === null || session.conferenceId !== args.conferenceId) {
      throw new Error("That session is not on this conference agenda");
    }

    const member = await ctx.db.get(args.membershipId);

    if (member === null || member.teamId !== conference.teamId) {
      throw new Error("That teammate is not on this team");
    }

    const noteId = await ctx.db.insert("notes", {
      conferenceId: args.conferenceId,
      sessionId: args.sessionId,
      membershipId: args.membershipId,
      body,
      source: args.source,
    });

    return { noteId };
  },
});

async function takeawayPromptsFor(
  ctx: QueryCtx,
  conferenceId: Id<"conferences">,
  endedAfter: number,
  endedBefore: number,
): Promise<TakeawayPrompt[]> {
  const plan = await ctx.db
    .query("plans")
    .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conferenceId))
    .order("desc")
    .first();

  if (plan === null) {
    return [];
  }

  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_plan", (q) => q.eq("planId", plan._id))
    .collect();

  const prompts: TakeawayPrompt[] = [];

  for (const assignment of assignments) {
    const session = await ctx.db.get(assignment.sessionId);

    if (session === null || session.endsAt <= endedAfter || session.endsAt > endedBefore) {
      continue;
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", assignment.sessionId))
      .collect();

    if (notes.some((note) => note.membershipId === assignment.membershipId)) {
      continue;
    }

    const member = await ctx.db.get(assignment.membershipId);

    if (member === null) {
      continue;
    }

    prompts.push({
      conferenceId,
      membershipId: assignment.membershipId,
      displayName: member.displayName,
      email: member.email,
      sessionId: assignment.sessionId,
      sessionTitle: session.title,
      sessionEndedAt: session.endsAt,
    });
  }

  return prompts;
}

export const pendingTakeawayPrompts = internalQuery({
  args: { conferenceId: v.id("conferences"), windowMinutes: v.number() },
  handler: async (ctx, args): Promise<TakeawayPrompt[]> => {
    const now = Date.now();
    return takeawayPromptsFor(ctx, args.conferenceId, now - args.windowMinutes * 60_000, now);
  },
});

export const recordDueTakeawayPrompts = internalMutation({
  args: { windowMinutes: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const endedAfter = now - args.windowMinutes * 60_000;
    const conferences = await ctx.db.query("conferences").collect();
    let recorded = 0;

    for (const conference of conferences) {
      const prompts = await takeawayPromptsFor(ctx, conference._id, endedAfter, now);

      if (prompts.length === 0) {
        continue;
      }

      const names = [...new Set(prompts.map((prompt) => prompt.displayName))].join(", ");

      await ctx.runMutation(internal.importWrites.recordActivity, {
        conferenceId: conference._id,
        kind: "takeaway_prompt_due",
        sponsor: "convex",
        durationMs: 0,
        summary: `${String(prompts.length)} takeaway prompts due: ${names} have no note yet from a session they attended`,
      });

      recorded += prompts.length;
    }

    return { conferences: conferences.length, recorded };
  },
});

export const setApproval = mutation({
  args: { noteId: v.id("notes"), approved: v.boolean() },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);

    if (note === null) {
      throw new Error("That takeaway no longer exists");
    }

    await ctx.db.patch(args.noteId, { approved: args.approved });

    return { approved: args.approved };
  },
});

export const addBriefRecipient = mutation({
  args: { conferenceId: v.id("conferences"), email: v.string(), addedBy: v.id("memberships") },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    if (!email.includes("@")) {
      throw new Error("A recipient needs a valid email address");
    }

    const existing = await ctx.db
      .query("briefRecipients")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    if (existing.some((row) => row.email === email)) {
      return { added: false };
    }

    await ctx.db.insert("briefRecipients", {
      conferenceId: args.conferenceId,
      email,
      addedBy: args.addedBy,
    });

    return { added: true };
  },
});

export const briefRecipients = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("briefRecipients")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    return rows.map((row) => ({ id: row._id, email: row.email }));
  },
});

export const removeBriefRecipient = mutation({
  args: { recipientId: v.id("briefRecipients") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.recipientId);
    return { removed: true };
  },
});
