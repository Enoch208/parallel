import { v } from "convex/values";
import { scoreFingerprint } from "./model/scoreFingerprint";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { bumpConstraintRevision } from "./constraints";
import { extractionModel, structuredOutput } from "./model/openaiClient";
import {
  batchSessions,
  buildScoringPrompt,
  indexById,
  parseScores,
  scoringJsonSchema,
  scoringSystemPrompt,
} from "./model/scoringSchema";
import type { ScoringGoal, ScoringSession } from "./model/scoringSchema";

const sessionsPerCall = 4;

interface ScoringTargets {
  readonly sessions: readonly (ScoringSession & { readonly id: Id<"sessions"> })[];
  readonly goals: readonly (ScoringGoal & { readonly id: Id<"goals"> })[];
}

interface ScoreRow {
  readonly sessionId: Id<"sessions">;
  readonly goalId: Id<"goals">;
  readonly relevance: number;
  readonly reason: string;
}

export interface ScoreConferenceResult {
  readonly model: string;
  readonly sessions: number;
  readonly goals: number;
  readonly calls: number;
  readonly pairsRequested: number;
  readonly pairsReused: number;
  readonly sessionsRescored: number;
  readonly pairsScored: number;
  readonly pairsDropped: number;
  readonly inserted: number;
  readonly replaced: number;
  readonly durationMs: number;
}

export const addGoals = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    goals: v.array(v.object({ label: v.string(), weight: v.number() })),
  },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const existing = await ctx.db
      .query("goals")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const labels = new Set(existing.map((goal) => goal.label));
    const goalIds: Id<"goals">[] = [];

    for (const goal of args.goals) {
      if (goal.label.trim().length === 0) {
        throw new Error("A goal needs a label");
      }

      if (!Number.isFinite(goal.weight) || goal.weight < 1 || goal.weight > 5) {
        throw new Error(`Goal weight must be between 1 and 5: ${goal.label}`);
      }

      if (labels.has(goal.label)) {
        continue;
      }

      labels.add(goal.label);
      goalIds.push(
        await ctx.db.insert("goals", {
          conferenceId: args.conferenceId,
          label: goal.label,
          weight: goal.weight,
        }),
      );
    }

    if (goalIds.length === 0) {
      return { inserted: 0, goalIds, constraintRevision: conference.constraintRevision };
    }

    const constraintRevision = await bumpConstraintRevision(ctx, args.conferenceId);
    return { inserted: goalIds.length, goalIds, constraintRevision };
  },
});

export const loadScoringTargets = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<ScoringTargets> => {
    const [sessions, goals] = await Promise.all([
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
    ]);

    return {
      sessions: sessions.map((session) => ({
        id: session._id,
        title: session.title,
        track: session.track,
        room: session.room,
        speakers: session.speakers,
      })),
      goals: goals.map((goal) => ({ id: goal._id, label: goal.label })),
    };
  },
});

export const writeScores = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    model: v.string(),
    scores: v.array(
      v.object({
        sessionId: v.id("sessions"),
        goalId: v.id("goals"),
        relevance: v.number(),
        reason: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const grouped = new Map<Id<"sessions">, ScoreRow[]>();

    for (const score of args.scores) {
      const bucket = grouped.get(score.sessionId);

      if (bucket === undefined) {
        grouped.set(score.sessionId, [score]);
      } else {
        bucket.push(score);
      }
    }

    let inserted = 0;
    let replaced = 0;

    for (const [sessionId, rows] of grouped) {
      const existing = await ctx.db
        .query("sessionGoalScores")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();

      const session = await ctx.db.get(sessionId);

      for (const row of rows) {
        const goal = await ctx.db.get(row.goalId);
        const fingerprint =
          session === null || goal === null
            ? undefined
            : scoreFingerprint({
                sessionTitle: session.title,
                sessionTrack: session.track,
                sessionRoom: session.room,
                speakers: session.speakers,
                goalLabel: goal.label,
                model: args.model,
              });

        const previous = existing.find((doc) => doc.goalId === row.goalId);

        if (previous === undefined) {
          await ctx.db.insert("sessionGoalScores", {
            conferenceId: args.conferenceId,
            sessionId: row.sessionId,
            goalId: row.goalId,
            relevance: row.relevance,
            reason: row.reason,
            model: args.model,
            ...(fingerprint === undefined ? {} : { inputFingerprint: fingerprint }),
          });
          inserted += 1;
        } else {
          await ctx.db.patch(previous._id, {
            relevance: row.relevance,
            reason: row.reason,
            model: args.model,
            ...(fingerprint === undefined ? {} : { inputFingerprint: fingerprint }),
          });
          replaced += 1;
        }
      }
    }

    return { inserted, replaced };
  },
});

function requireOpenAiKey(): string {
  const value = process.env.OPENAI_API_KEY;

  if (value === undefined || value.length === 0) {
    throw new Error("OPENAI_API_KEY is not set on this deployment");
  }

  return value;
}

export const scoreConference = action({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<ScoreConferenceResult> => {
    const apiKey = requireOpenAiKey();

    const targets: ScoringTargets = await ctx.runQuery(internal.scoring.loadScoringTargets, {
      conferenceId: args.conferenceId,
    });

    if (targets.sessions.length === 0) {
      throw new Error("Import an agenda before scoring");
    }

    if (targets.goals.length === 0) {
      throw new Error("Add at least one goal before scoring");
    }

    const sessionById = indexById(targets.sessions);
    const goalById = indexById(targets.goals);
    const goalIds = new Set(goalById.keys());

    const reuse: { reusable: number; staleSessionIds: string[] } = await ctx.runQuery(
      internal.scoringReuse.reuseReport,
      { conferenceId: args.conferenceId, model: extractionModel },
    );

    const staleSessions = new Set(reuse.staleSessionIds);
    const sessionsToScore = targets.sessions.filter((session) => staleSessions.has(session.id));

    const startedAt = Date.now();
    let calls = 0;
    let pairsScored = 0;
    let inserted = 0;
    let replaced = 0;

    for (const batch of batchSessions(sessionsToScore, sessionsPerCall)) {
      const raw = await structuredOutput({
        model: extractionModel,
        system: scoringSystemPrompt,
        user: buildScoringPrompt(batch, targets.goals),
        schemaName: "session_goal_scores",
        schema: scoringJsonSchema,
        apiKey,
      });
      calls += 1;

      const batchSessionIds = new Set(batch.map((session): string => session.id));
      const pairs = parseScores(raw, batchSessionIds, goalIds);

      const rows = pairs.flatMap((pair): ScoreRow[] => {
        const session = sessionById.get(pair.sessionId);
        const goal = goalById.get(pair.goalId);

        if (session === undefined || goal === undefined) {
          return [];
        }

        return [
          {
            sessionId: session.id,
            goalId: goal.id,
            relevance: pair.relevance,
            reason: pair.reason,
          },
        ];
      });

      const written: { inserted: number; replaced: number } = await ctx.runMutation(
        internal.scoring.writeScores,
        { conferenceId: args.conferenceId, model: extractionModel, scores: rows },
      );

      pairsScored += rows.length;
      inserted += written.inserted;
      replaced += written.replaced;
    }

    const durationMs = Date.now() - startedAt;
    const pairsRequested = targets.sessions.length * targets.goals.length;

    await ctx.runMutation(internal.importWrites.recordActivity, {
      conferenceId: args.conferenceId,
      kind: "sessions_scored",
      sponsor: "openai",
      durationMs,
      summary:
        sessionsToScore.length === 0
          ? `Nothing to score: all ${String(pairsRequested)} session and goal pairs were already current`
          : `${extractionModel} scored ${String(pairsScored)} pair${pairsScored === 1 ? "" : "s"} across ${String(calls)} call${calls === 1 ? "" : "s"}, reusing ${String(reuse.reusable)} of ${String(pairsRequested)} still current`,
    });

    return {
      model: extractionModel,
      sessions: targets.sessions.length,
      goals: targets.goals.length,
      calls,
      pairsRequested,
      pairsReused: reuse.reusable,
      sessionsRescored: sessionsToScore.length,
      pairsScored,
      pairsDropped: pairsRequested - pairsScored,
      inserted,
      replaced,
      durationMs,
    };
  },
});
