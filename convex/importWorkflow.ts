import { v, type Infer } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { sendEvent, vWorkflowId, type WorkflowId } from "@convex-dev/workflow";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { agendaExtractionSchema, agendaSystemPrompt, parseExtraction } from "./model/agendaSchema";
import { contentHash } from "./model/firecrawlClient";
import { scrapeAgendaThroughComponent } from "./model/firecrawlComponent";
import { extractionModel, structuredOutput } from "./model/openaiClient";
import { sliceForDay } from "./model/agendaSlice";
import { zonedTimeToEpoch } from "./model/zonedTime";
import { assertConferenceTimezone } from "./model/timezone";
import { importWorkflows, scoringPool } from "./model/workpools";

const scoringFinishedEvent = "importScoringFinished";

const goalInput = v.object({ label: v.string(), weight: v.number() });

const importRunSummary = v.object({
  characters: v.number(),
  extracted: v.number(),
  validated: v.number(),
  inserted: v.number(),
  scoredPairs: v.number(),
});

export type ImportRunSummary = Infer<typeof importRunSummary>;

export interface ImportRunStatus {
  readonly type: "inProgress" | "completed" | "canceled" | "failed";
  readonly running: string[];
  readonly error: string | null;
}

interface FetchedAgenda {
  readonly durationMs: number;
  readonly slice: string;
  readonly contentHash: string;
  readonly characters: number;
  readonly fetchedAt: number;
}

type Confidence = "high" | "low";

interface NormalizedSession {
  readonly externalKey: string;
  readonly title: string;
  readonly track: string | null;
  readonly room: string | null;
  readonly speakers: string[];
  readonly startsAt: number;
  readonly endsAt: number;
  readonly titleConfidence: Confidence;
  readonly timeConfidence: Confidence;
  readonly roomConfidence: Confidence;
}

interface NormalizedAgenda {
  readonly durationMs: number;
  readonly extracted: number;
  readonly sessions: NormalizedSession[];
}

function requireKey(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set on this deployment`);
  }

  return value;
}

export const fetchAgendaPage = internalAction({
  args: { agendaUrl: v.string(), dayMarker: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<FetchedAgenda> => {
    const startedAt = Date.now();
    const page = await scrapeAgendaThroughComponent(ctx, components.firecrawl, args.agendaUrl);

    return {
      durationMs: Date.now() - startedAt,
      slice: sliceForDay(page.markdown, args.dayMarker),
      contentHash: await contentHash(page.markdown),
      characters: page.markdown.length,
      fetchedAt: Date.now(),
    };
  },
});

export const normalizeSessions = internalAction({
  args: { markdown: v.string(), timezone: v.string() },
  handler: async (_ctx, args): Promise<NormalizedAgenda> => {
    const startedAt = Date.now();
    const raw = await structuredOutput({
      model: extractionModel,
      system: agendaSystemPrompt,
      user: args.markdown,
      schemaName: "agenda",
      schema: agendaExtractionSchema,
      apiKey: requireKey("OPENAI_API_KEY"),
    });
    const durationMs = Date.now() - startedAt;
    const extracted = parseExtraction(raw);

    const sessions = extracted.flatMap((session) => {
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

    return { durationMs, extracted: extracted.length, sessions };
  },
});

export const conferenceCounts = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<{ goals: number; sessions: number; scoredPairs: number }> => {
    const [goals, sessions, scores] = await Promise.all([
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("sessionGoalScores")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
    ]);

    return { goals: goals.length, sessions: sessions.length, scoredPairs: scores.length };
  },
});

export const enqueueScoring = internalMutation({
  args: { conferenceId: v.id("conferences"), workflowId: vWorkflowId },
  handler: async (ctx, args): Promise<void> => {
    await scoringPool.enqueueAction(
      ctx,
      api.scoring.scoreConference,
      { conferenceId: args.conferenceId },
      {
        onComplete: internal.importWorkflow.scoringFinished,
        context: { workflowId: args.workflowId },
      },
    );
  },
});

export const scoringFinished = internalMutation({
  args: vOnCompleteArgs(v.object({ workflowId: vWorkflowId })),
  handler: async (ctx, args): Promise<void> => {
    if (args.result.kind === "success") {
      await sendEvent(ctx, components.workflow, {
        name: scoringFinishedEvent,
        workflowId: args.context.workflowId,
      });
      return;
    }

    await sendEvent(ctx, components.workflow, {
      name: scoringFinishedEvent,
      workflowId: args.context.workflowId,
      error: args.result.kind === "failed" ? args.result.error : "Scoring was canceled",
    });
  },
});

export const runImport = importWorkflows.define({
  args: {
    conferenceId: v.id("conferences"),
    agendaUrl: v.string(),
    timezone: v.string(),
    dayMarker: v.union(v.string(), v.null()),
    goals: v.array(goalInput),
  },
  returns: importRunSummary,
  handler: async (step, args): Promise<ImportRunSummary> => {
    const conferenceId = args.conferenceId;

    const page = await step.runAction(
      internal.importWorkflow.fetchAgendaPage,
      { agendaUrl: args.agendaUrl, dayMarker: args.dayMarker },
      { name: "fetch agenda", retry: true },
    );
    await step.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "agenda_fetched",
      sponsor: "firecrawl",
      durationMs: page.durationMs,
      summary: `Scraped ${String(page.characters)} characters from the public agenda page`,
    });

    const sourceStart = Date.now();
    const sourceId = await step.runMutation(internal.importWrites.recordSource, {
      conferenceId,
      url: args.agendaUrl,
      fetchedAt: page.fetchedAt,
      contentHash: page.contentHash,
    });
    await step.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "agenda_fetched",
      sponsor: "convex",
      durationMs: Date.now() - sourceStart,
      summary: `Recorded provenance ${page.contentHash} for ${args.agendaUrl}`,
    });

    const normalized = await step.runAction(
      internal.importWorkflow.normalizeSessions,
      { markdown: page.slice, timezone: args.timezone },
      { name: "normalize sessions", retry: true },
    );
    await step.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "sessions_extracted",
      sponsor: "openai",
      durationMs: normalized.durationMs,
      summary: `${extractionModel} returned ${String(normalized.extracted)} sessions, ${String(normalized.sessions.length)} with times that validated`,
    });

    const insertStart = Date.now();
    const inserted = await step.runMutation(internal.importWrites.insertSessions, {
      conferenceId,
      sourceId,
      sessions: normalized.sessions,
    });
    await step.runMutation(internal.importWrites.recordActivity, {
      conferenceId,
      kind: "agenda_imported",
      sponsor: "convex",
      durationMs: Date.now() - insertStart,
      summary: `Inserted ${String(inserted)} of ${String(normalized.sessions.length)} sessions, ${String(normalized.sessions.length - inserted)} already present`,
    });

    if (args.goals.length > 0) {
      await step.runMutation(
        internal.scoring.addGoals,
        { conferenceId, goals: args.goals },
        { name: "add goals" },
      );
    }

    const counts = await step.runQuery(
      internal.importWorkflow.conferenceCounts,
      { conferenceId },
      { name: "count goals and sessions" },
    );

    if (counts.goals === 0 || counts.sessions === 0) {
      return {
        characters: page.characters,
        extracted: normalized.extracted,
        validated: normalized.sessions.length,
        inserted,
        scoredPairs: 0,
      };
    }

    await step.runMutation(
      internal.importWorkflow.enqueueScoring,
      { conferenceId, workflowId: step.workflowId },
      { name: "enqueue scoring" },
    );
    await step.awaitEvent({ name: scoringFinishedEvent });

    const scored = await step.runQuery(
      internal.importWorkflow.conferenceCounts,
      { conferenceId },
      { name: "count scored pairs" },
    );

    return {
      characters: page.characters,
      extracted: normalized.extracted,
      validated: normalized.sessions.length,
      inserted,
      scoredPairs: scored.scoredPairs,
    };
  },
});

export const startImport = mutation({
  args: {
    agendaUrl: v.string(),
    conferenceName: v.string(),
    teamName: v.string(),
    timezone: v.string(),
    dayMarker: v.union(v.string(), v.null()),
    goals: v.optional(v.array(goalInput)),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ workflowId: WorkflowId; conferenceId: Id<"conferences"> }> => {
    assertConferenceTimezone(args.timezone);

    const created: { teamId: Id<"teams">; conferenceId: Id<"conferences"> } = await ctx.runMutation(
      internal.importWrites.createConference,
      {
        teamName: args.teamName,
        name: args.conferenceName,
        agendaUrl: args.agendaUrl,
        timezone: args.timezone,
        dayMarker: args.dayMarker,
      },
    );

    const workflowId = await importWorkflows.start(
      ctx,
      internal.importWorkflow.runImport,
      {
        conferenceId: created.conferenceId,
        agendaUrl: args.agendaUrl,
        timezone: args.timezone,
        dayMarker: args.dayMarker,
        goals: args.goals ?? [],
      },
      { startAsync: true },
    );

    return { workflowId, conferenceId: created.conferenceId };
  },
});

export const runStatus = query({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, args): Promise<ImportRunStatus> => {
    const status = await importWorkflows.status(ctx, args.workflowId);

    if (status.type === "inProgress") {
      return { type: "inProgress", running: status.running.map((step) => step.name), error: null };
    }

    if (status.type === "failed") {
      return { type: "failed", running: [], error: status.error };
    }

    return { type: status.type, running: [], error: null };
  },
});
