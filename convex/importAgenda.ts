import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { agendaExtractionSchema, agendaSystemPrompt, parseExtraction } from "./model/agendaSchema";
import { contentHash, scrapeAgenda } from "./model/firecrawlClient";
import { extractionModel, structuredOutput } from "./model/openaiClient";
import { sliceForDay } from "./model/agendaSlice";
import { zonedTimeToEpoch } from "./model/zonedTime";

export interface ImportResult {
  readonly conferenceId: Id<"conferences">;
  readonly scraped: number;
  readonly extracted: number;
  readonly validated: number;
  readonly inserted: number;
  readonly droppedForBadTimes: number;
}

function requireKey(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set on this deployment`);
  }

  return value;
}

export const importAgenda = action({
  args: {
    agendaUrl: v.string(),
    conferenceName: v.string(),
    teamName: v.string(),
    timezone: v.string(),
    dayMarker: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    const firecrawlKey = requireKey("FIRECRAWL_API_KEY");
    const openaiKey = requireKey("OPENAI_API_KEY");

    const created: { teamId: Id<"teams">; conferenceId: Id<"conferences"> } = await ctx.runMutation(
      internal.importWrites.createConference,
      {
        teamName: args.teamName,
        name: args.conferenceName,
        agendaUrl: args.agendaUrl,
        timezone: args.timezone,
      },
    );
    const conferenceId = created.conferenceId;

    const scrapeStart = Date.now();
    const page = await scrapeAgenda(args.agendaUrl, firecrawlKey);
    const scrapeMs = Date.now() - scrapeStart;
    const fetchedAt = Date.now();

    const sourceId: Id<"sources"> = await ctx.runMutation(internal.importWrites.recordSource, {
      conferenceId,
      url: args.agendaUrl,
      fetchedAt,
      contentHash: await contentHash(page.markdown),
    });

    await ctx.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "agenda_fetched",
      sponsor: "firecrawl",
      durationMs: scrapeMs,
      summary: `Scraped ${String(page.markdown.length)} characters from the public agenda page`,
    });

    const extractStart = Date.now();
    const raw = await structuredOutput({
      model: extractionModel,
      system: agendaSystemPrompt,
      user: sliceForDay(page.markdown, args.dayMarker),
      schemaName: "agenda",
      schema: agendaExtractionSchema,
      apiKey: openaiKey,
    });
    const extractMs = Date.now() - extractStart;
    const extracted = parseExtraction(raw);

    const usable = extracted.flatMap((session) => {
      if (session.startsAtLocal === null || session.endsAtLocal === null) {
        return [];
      }

      const startsAt = zonedTimeToEpoch(session.startsAtLocal, args.timezone);
      const endsAt = zonedTimeToEpoch(session.endsAtLocal, args.timezone);

      if (startsAt === null || endsAt === null || endsAt <= startsAt) {
        return [];
      }

      return [
        {
          externalKey: `${session.title}@${session.startsAtLocal}`,
          title: session.title,
          track: session.track,
          room: session.room,
          speakers: [...session.speakers],
          startsAt,
          endsAt,
          titleConfidence: session.titleConfidence,
          timeConfidence: session.timeConfidence,
          roomConfidence: session.roomConfidence,
        },
      ];
    });

    await ctx.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "sessions_extracted",
      sponsor: "openai",
      durationMs: extractMs,
      summary: `${extractionModel} returned ${String(extracted.length)} sessions, ${String(usable.length)} with times that validated`,
    });

    const inserted: number = await ctx.runMutation(internal.importWrites.insertSessions, {
      conferenceId,
      sourceId,
      sessions: usable,
    });

    return {
      conferenceId,
      scraped: page.markdown.length,
      extracted: extracted.length,
      validated: usable.length,
      inserted,
      droppedForBadTimes: extracted.length - usable.length,
    };
  },
});
