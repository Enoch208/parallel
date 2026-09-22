import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { loadTripSummary } from "./model/loadTripSummary";
import { extractionModel, structuredOutput } from "./model/openaiClient";
import {
  briefJsonSchema,
  briefSystemPrompt,
  buildBriefPrompt,
  parseBrief,
  renderBriefBody,
  verifyBriefSources,
} from "./model/briefSchema";
import type { BriefGoalInput, BriefNoteInput, BriefSessionInput } from "./model/briefSchema";
import { assertWritable } from "./model/frozenConference";
import { assertWritableFromAction } from "./frozen";
import { rateLimited, rateLimiter } from "./model/rateLimits";

interface BriefInputs {
  readonly eventName: string;
  readonly goals: readonly BriefGoalInput[];
  readonly notes: readonly BriefNoteInput[];
  readonly sessions: readonly BriefSessionInput[];
  readonly recipients: readonly string[];
}

export const loadBriefInputs = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<BriefInputs> => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const [noteRows, goalRows, sessionRows, memberRows] = await Promise.all([
      ctx.db
        .query("notes")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
    ]);

    const extraRecipients = await ctx.db
      .query("briefRecipients")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const titleById = new Map(sessionRows.map((session) => [session._id, session.title]));
    const nameById = new Map(memberRows.map((member) => [member._id, member.displayName]));

    return {
      eventName: conference.name,
      goals: goalRows.map((goal) => ({ id: goal._id, label: goal.label, weight: goal.weight })),
      notes: noteRows
        .filter((note) => note.approved !== false)
        .map((note) => ({
          id: note._id,
          sessionId: note.sessionId,
          sessionTitle: titleById.get(note.sessionId) ?? "Unknown session",
          authorName: nameById.get(note.membershipId) ?? "Unknown teammate",
          body: note.body,
        })),
      sessions: sessionRows.map((session) => ({
        id: session._id,
        title: session.title,
        track: session.track,
        speakers: session.speakers,
      })),
      recipients: [
        ...memberRows.filter((member) => member.isLead).map((member) => member.email),
        ...extraRecipients.map((row) => row.email),
      ],
    };
  },
});

export const storeBrief = internalMutation({
  args: {
    conferenceId: v.id("conferences"),
    body: v.string(),
    model: v.string(),
    recipients: v.array(v.string()),
    tripCostEstimate: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => ctx.db.insert("briefs", { ...args, sentAt: null }),
});

export const markSent = mutation({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);

    if (brief === null) {
      throw new Error("Brief not found");
    }

    await assertWritable(ctx, brief.conferenceId);

    if (brief.sentAt !== null) {
      return { sentAt: brief.sentAt, alreadySent: true };
    }

    const sentAt = Date.now();
    await ctx.db.patch(args.briefId, { sentAt });

    return { sentAt, alreadySent: false };
  },
});

export interface GenerateBriefResult {
  readonly briefId: Id<"briefs">;
  readonly model: string;
  readonly sections: number;
  readonly claims: number;
  readonly notesUsed: number;
  readonly malformedSections: number;
  readonly malformedClaims: number;
  readonly unknownGoalSections: number;
  readonly unknownSourceClaims: number;
  readonly emptiedSections: number;
  readonly recipients: readonly string[];
  readonly body: string;
  readonly durationMs: number;
}

function requireOpenAiKey(): string {
  const value = process.env.OPENAI_API_KEY;

  if (value === undefined || value.length === 0) {
    throw new Error("OPENAI_API_KEY is not set on this deployment");
  }

  return value;
}

export const generateBrief = action({
  args: {
    conferenceId: v.id("conferences"),
    tripCostEstimate: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args): Promise<GenerateBriefResult> => {
    await assertWritableFromAction(ctx, args.conferenceId);

    const allowance = await rateLimiter.limit(ctx, "briefGeneration", {
      key: args.conferenceId,
    });

    if (!allowance.ok) {
      throw rateLimited(
        "This conference's brief has been rewritten several times in the last few minutes.",
        allowance.retryAfter,
      );
    }

    const apiKey = requireOpenAiKey();
    const inputs: BriefInputs = await ctx.runQuery(internal.brief.loadBriefInputs, {
      conferenceId: args.conferenceId,
    });

    if (inputs.goals.length === 0) {
      throw new ConvexError("Add at least one goal before writing a brief");
    }

    if (inputs.notes.length === 0) {
      throw new ConvexError("There are no takeaways to write a brief from");
    }

    const startedAt = Date.now();
    const raw = await structuredOutput({
      model: extractionModel,
      system: briefSystemPrompt,
      user: buildBriefPrompt(inputs.eventName, inputs.goals, inputs.notes, inputs.sessions),
      schemaName: "team_brief",
      schema: briefJsonSchema,
      apiKey,
    });

    const parsed = parseBrief(raw);
    const verified = verifyBriefSources(parsed.sections, {
      goalIds: new Set(inputs.goals.map((goal) => goal.id)),
      noteIds: new Set(inputs.notes.map((note) => note.id)),
      sessionIds: new Set(inputs.sessions.map((session) => session.id)),
    });

    const labels = new Map<string, string>(
      inputs.sessions.map((session) => [session.id, session.title]),
    );

    for (const note of inputs.notes) {
      labels.set(note.id, `${note.authorName} on ${note.sessionTitle}`);
    }

    const body = renderBriefBody(inputs.eventName, verified.sections, labels);
    const durationMs = Date.now() - startedAt;
    const claims = verified.sections.reduce((total, section) => total + section.claims.length, 0);

    const briefId: Id<"briefs"> = await ctx.runMutation(internal.brief.storeBrief, {
      conferenceId: args.conferenceId,
      body,
      model: extractionModel,
      recipients: [...inputs.recipients],
      tripCostEstimate: args.tripCostEstimate,
    });

    const dropped =
      verified.unknownSourceClaims + parsed.malformedClaims + parsed.malformedSections;

    await ctx.runMutation(internal.importWrites.recordActivity, {
      conferenceId: args.conferenceId,
      kind: "brief_generated",
      sponsor: "openai",
      durationMs,
      summary: `${extractionModel} wrote ${String(claims)} sourced claims across ${String(verified.sections.length)} goals from ${String(inputs.notes.length)} takeaways, dropping ${String(dropped)} unsourced or malformed`,
    });

    return {
      briefId,
      model: extractionModel,
      sections: verified.sections.length,
      claims,
      notesUsed: inputs.notes.length,
      malformedSections: parsed.malformedSections,
      malformedClaims: parsed.malformedClaims,
      unknownGoalSections: verified.unknownGoalSections,
      unknownSourceClaims: verified.unknownSourceClaims,
      emptiedSections: verified.emptiedSections,
      recipients: inputs.recipients,
      body,
      durationMs,
    };
  },
});

export const latest = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return null;
    }

    const brief = await ctx.db
      .query("briefs")
      .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    const tripSummary = await loadTripSummary(
      ctx,
      conference,
      brief === null ? null : brief.tripCostEstimate,
    );

    return {
      brief:
        brief === null
          ? null
          : {
              id: brief._id,
              body: brief.body,
              model: brief.model,
              recipients: brief.recipients,
              tripCostEstimate: brief.tripCostEstimate,
              sentAt: brief.sentAt,
              createdAt: brief._creationTime,
            },
      tripSummary,
    };
  },
});
