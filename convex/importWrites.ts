import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const confidence = v.union(v.literal("high"), v.literal("low"));

export const createConference = internalMutation({
  args: {
    teamName: v.string(),
    name: v.string(),
    agendaUrl: v.string(),
    timezone: v.string(),
    dayMarker: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const teamId = await ctx.db.insert("teams", { name: args.teamName, isDemo: false });

    const conferenceId = await ctx.db.insert("conferences", {
      teamId,
      name: args.name,
      agendaUrl: args.agendaUrl,
      timezone: args.timezone,
      constraintRevision: 0,
      isDemoData: false,
      dayMarker: args.dayMarker === undefined ? null : args.dayMarker,
    });

    return { teamId, conferenceId };
  },
});

export const recordSource = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    url: v.string(),
    fetchedAt: v.number(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => ctx.db.insert("sources", args),
});

export const insertSessions = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    sourceId: v.id("sources"),
    sessions: v.array(
      v.object({
        externalKey: v.string(),
        title: v.string(),
        track: v.union(v.string(), v.null()),
        room: v.union(v.string(), v.null()),
        speakers: v.array(v.string()),
        startsAt: v.number(),
        endsAt: v.number(),
        titleConfidence: confidence,
        timeConfidence: confidence,
        roomConfidence: confidence,
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const session of args.sessions) {
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_external_key", (q) =>
          q.eq("conferenceId", args.conferenceId).eq("externalKey", session.externalKey),
        )
        .first();

      if (existing !== null) {
        continue;
      }

      await ctx.db.insert("sessions", {
        conferenceId: args.conferenceId,
        sourceId: args.sourceId,
        ...session,
      });
      inserted += 1;
    }

    return inserted;
  },
});

export const recordActivity = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    kind: v.string(),
    sponsor: v.union(
      v.literal("firecrawl"),
      v.literal("openai"),
      v.literal("agentmail"),
      v.literal("convex"),
    ),
    durationMs: v.number(),
    summary: v.string(),
  },
  handler: async (ctx, args) => ctx.db.insert("activity", args),
});
