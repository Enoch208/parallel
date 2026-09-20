import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { agendaExtractionSchema, agendaSystemPrompt, parseExtraction } from "./model/agendaSchema";
import { contentHash, scrapeAgenda } from "./model/firecrawlClient";
import { extractionModel, structuredOutput } from "./model/openaiClient";
import { zonedTimeToEpoch } from "./model/zonedTime";
import {
  diffAgenda,
  movedOrCancelled,
  type DiffableSession,
  type SessionChange,
} from "./model/agendaDiff";
import { sliceForDay } from "./model/agendaSlice";

export const currentAgenda = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return null;
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const latestSource = await ctx.db
      .query("sources")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    return {
      agendaUrl: conference.agendaUrl,
      timezone: conference.timezone,
      dayMarker: conference.dayMarker === undefined ? null : conference.dayMarker,
      lastContentHash: latestSource === null ? null : latestSource.contentHash,
      sessions: sessions.map((session) => ({
        externalKey: session.externalKey,
        title: session.title,
        room: session.room,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      })),
    };
  },
});

export const recordDetectedChange = internalMutation({
  args: { conferenceId: v.id("conferences"), changeCount: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("activity", {
      conferenceId: args.conferenceId,
      kind: "agenda_change_detected",
      sponsor: "firecrawl",
      durationMs: 0,
      summary: `The published agenda page changed. ${String(args.changeCount)} session difference${args.changeCount === 1 ? "" : "s"} await the lead's review.`,
    });

    return { recorded: true };
  },
});

export const previewChanges = action({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<{ changes: SessionChange[]; unchanged: number }> => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (firecrawlKey === undefined || openaiKey === undefined) {
      throw new Error("FIRECRAWL_API_KEY and OPENAI_API_KEY must be set on this deployment");
    }

    const current = await ctx.runQuery(internal.agendaWatch.currentAgenda, {
      conferenceId: args.conferenceId,
    });

    if (current === null) {
      return { changes: [], unchanged: 0 };
    }

    const page = await scrapeAgenda(current.agendaUrl, firecrawlKey);
    const raw = await structuredOutput({
      model: extractionModel,
      system: agendaSystemPrompt,
      user: sliceForDay(page.markdown, current.dayMarker),
      schemaName: "agenda",
      schema: agendaExtractionSchema,
      apiKey: openaiKey,
    });

    const next = parseExtraction(raw).flatMap((session) => {
      if (session.startsAtLocal === null || session.endsAtLocal === null) {
        return [];
      }

      const startsAt = zonedTimeToEpoch(session.startsAtLocal, current.timezone);
      const endsAt = zonedTimeToEpoch(session.endsAtLocal, current.timezone);

      if (startsAt === null || endsAt === null || endsAt <= startsAt) {
        return [];
      }

      return [
        {
          externalKey: `${session.title}@${session.startsAtLocal}`,
          title: session.title,
          room: session.room,
          startsAt,
          endsAt,
        },
      ];
    });

    const diff = diffAgenda(current.sessions, next);

    return { changes: [...diff.changes], unchanged: diff.unchanged };
  },
});

export const confirmAgendaChanges = mutation({
  args: {
    conferenceId: v.id("conferences"),
    contentHash: v.string(),
    next: v.array(
      v.object({
        externalKey: v.string(),
        title: v.string(),
        room: v.union(v.string(), v.null()),
        startsAt: v.number(),
        endsAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const previous: DiffableSession[] = existing.map((session) => ({
      externalKey: session.externalKey,
      title: session.title,
      room: session.room,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    }));

    const diff = diffAgenda(previous, args.next);

    if (diff.changes.length === 0) {
      return { changed: 0, unchanged: diff.unchanged, affectedAssignments: 0, preserved: 0 };
    }

    const byKey = new Map(existing.map((session) => [session.externalKey, session]));
    const nextByKey = new Map(args.next.map((session) => [session.externalKey, session]));

    for (const change of diff.changes) {
      const row = byKey.get(change.externalKey);
      const incoming = nextByKey.get(change.externalKey);

      if (change.kind === "added" || row === undefined || incoming === undefined) {
        continue;
      }

      await ctx.db.patch(row._id, {
        title: incoming.title,
        room: incoming.room,
        startsAt: incoming.startsAt,
        endsAt: incoming.endsAt,
      });
    }

    const disrupting = new Set(movedOrCancelled(diff).map((change) => change.externalKey));

    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    let affected = 0;
    let preserved = 0;

    if (plan !== null) {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();

      for (const assignment of assignments) {
        const row = await ctx.db.get(assignment.sessionId);

        if (row !== null && disrupting.has(row.externalKey)) {
          affected += 1;
        } else {
          preserved += 1;
        }
      }
    }

    await ctx.db.patch(args.conferenceId, {
      constraintRevision: conference.constraintRevision + 1,
    });

    await ctx.db.insert("sources", {
      conferenceId: args.conferenceId,
      url: conference.agendaUrl,
      fetchedAt: Date.now(),
      contentHash: args.contentHash,
    });

    await ctx.db.insert("activity", {
      conferenceId: args.conferenceId,
      kind: "agenda_changed",
      sponsor: "firecrawl",
      durationMs: 0,
      summary: `Agenda changed: ${String(diff.changes.length)} session${diff.changes.length === 1 ? "" : "s"}, ${String(affected)} assignment${affected === 1 ? "" : "s"} affected, ${String(preserved)} preserved`,
    });

    return {
      changed: diff.changes.length,
      unchanged: diff.unchanged,
      affectedAssignments: affected,
      preserved,
    };
  },
});

export const detectAgendaChange = action({
  args: { conferenceId: v.id("conferences"), force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    checked: boolean;
    unchangedPage: boolean;
    changed: number;
    affectedAssignments: number;
    preserved: number;
  }> => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (firecrawlKey === undefined || openaiKey === undefined) {
      throw new Error("FIRECRAWL_API_KEY and OPENAI_API_KEY must be set on this deployment");
    }

    const current = await ctx.runQuery(internal.agendaWatch.currentAgenda, {
      conferenceId: args.conferenceId,
    });

    if (current === null) {
      return {
        checked: false,
        unchangedPage: false,
        changed: 0,
        affectedAssignments: 0,
        preserved: 0,
      };
    }

    const page = await scrapeAgenda(current.agendaUrl, firecrawlKey);
    const hash = await contentHash(page.markdown);

    if (hash === current.lastContentHash && args.force !== true) {
      return {
        checked: true,
        unchangedPage: true,
        changed: 0,
        affectedAssignments: 0,
        preserved: 0,
      };
    }

    const raw = await structuredOutput({
      model: extractionModel,
      system: agendaSystemPrompt,
      user: sliceForDay(page.markdown, current.dayMarker),
      schemaName: "agenda",
      schema: agendaExtractionSchema,
      apiKey: openaiKey,
    });

    const next = parseExtraction(raw).flatMap((session) => {
      if (session.startsAtLocal === null || session.endsAtLocal === null) {
        return [];
      }

      const startsAt = zonedTimeToEpoch(session.startsAtLocal, current.timezone);
      const endsAt = zonedTimeToEpoch(session.endsAtLocal, current.timezone);

      if (startsAt === null || endsAt === null || endsAt <= startsAt) {
        return [];
      }

      return [
        {
          externalKey: `${session.title}@${session.startsAtLocal}`,
          title: session.title,
          room: session.room,
          startsAt,
          endsAt,
        },
      ];
    });

    const diff = diffAgenda(current.sessions, next);

    await ctx.runMutation(internal.agendaWatch.recordDetectedChange, {
      conferenceId: args.conferenceId,
      changeCount: diff.changes.length,
    });

    return {
      checked: true,
      unchangedPage: false,
      changed: diff.changes.length,
      affectedAssignments: 0,
      preserved: diff.unchanged,
    };
  },
});
