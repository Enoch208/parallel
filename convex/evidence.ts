import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { PlanStatus, SessionConfidence } from "./model/types";

export interface SourceRecord {
  readonly url: string;
  readonly fetchedAt: number;
  readonly contentHash: string;
}

export interface SessionProvenance {
  readonly sessionId: string;
  readonly title: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly source: SourceRecord | null;
  readonly titleConfidence: SessionConfidence;
  readonly timeConfidence: SessionConfidence;
  readonly roomConfidence: SessionConfidence;
}

export interface AssignmentProvenance {
  readonly assignmentId: string;
  readonly memberName: string;
  readonly memberEmail: string;
  readonly sessionTitle: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly pinned: boolean;
  readonly reason: string;
  readonly computedAtRevision: number;
}

export interface PlanProvenance {
  readonly planId: string;
  readonly status: PlanStatus;
  readonly computedAt: number;
  readonly computedAtRevision: number;
  readonly conferenceRevision: number;
  readonly assignments: readonly AssignmentProvenance[];
}

export interface ReplyRecord {
  readonly eventId: string;
  readonly receivedAt: number;
  readonly fromAddress: string;
  readonly subject: string;
  readonly intent: string | null;
  readonly confidence: number | null;
  readonly quote: string | null;
  readonly resolvedByHand: boolean;
}

export interface ConstraintRecord {
  readonly blockId: string;
  readonly memberName: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly reason: string;
  readonly sourceQuote: string | null;
  readonly reply: ReplyRecord | null;
}

export interface ConstraintTrail {
  readonly blocks: readonly ConstraintRecord[];
  readonly unlinkedReplies: readonly ReplyRecord[];
}

export interface RelevanceProvenance {
  readonly scoreId: string;
  readonly sessionTitle: string;
  readonly goalLabel: string;
  readonly relevance: number;
  readonly reason: string;
  readonly model: string;
}

export interface RelevanceSample {
  readonly totalScores: number;
  readonly sample: readonly RelevanceProvenance[];
}

const normalizeQuote = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/["'“”‘’]/g, "");

const toReplyRecord = (event: Doc<"emailEvents">): ReplyRecord => ({
  eventId: event._id,
  receivedAt: event._creationTime,
  fromAddress: event.fromAddress,
  subject: event.subject,
  intent: event.intent,
  confidence: event.confidence,
  quote: event.quote,
  resolvedByHand: event.resolvedByHand === true,
});

export const agendaProvenance = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<readonly SessionProvenance[]> => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return [];
    }

    const [sessions, sources] = await Promise.all([
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", conference._id))
        .order("asc")
        .collect(),
      ctx.db
        .query("sources")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
    ]);

    const bySourceId = new Map(sources.map((source) => [source._id, source]));

    return sessions.map((session) => {
      const source = bySourceId.get(session.sourceId);

      return {
        sessionId: session._id,
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        source:
          source === undefined
            ? null
            : { url: source.url, fetchedAt: source.fetchedAt, contentHash: source.contentHash },
        titleConfidence: session.titleConfidence,
        timeConfidence: session.timeConfidence,
        roomConfidence: session.roomConfidence,
      };
    });
  },
});

export const assignmentProvenance = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<PlanProvenance | null> => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return null;
    }

    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conference._id))
      .order("desc")
      .first();

    if (plan === null) {
      return null;
    }

    const [assignments, sessions, members] = await Promise.all([
      ctx.db
        .query("assignments")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
    ]);

    const sessionById = new Map(sessions.map((session) => [session._id, session]));
    const memberById = new Map(members.map((member) => [member._id, member]));

    const rows = assignments.flatMap((assignment): AssignmentProvenance[] => {
      const session = sessionById.get(assignment.sessionId);
      const member = memberById.get(assignment.membershipId);

      if (session === undefined || member === undefined) {
        return [];
      }

      return [
        {
          assignmentId: assignment._id,
          memberName: member.displayName,
          memberEmail: member.email,
          sessionTitle: session.title,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          pinned: assignment.pinned,
          reason: assignment.reason,
          computedAtRevision: plan.computedAtRevision,
        },
      ];
    });

    rows.sort((left, right) =>
      left.memberName === right.memberName
        ? left.startsAt - right.startsAt
        : left.memberName.localeCompare(right.memberName),
    );

    return {
      planId: plan._id,
      status: plan.status,
      computedAt: plan.computedAt,
      computedAtRevision: plan.computedAtRevision,
      conferenceRevision: conference.constraintRevision,
      assignments: rows,
    };
  },
});

export const constraintTrail = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<ConstraintTrail> => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return { blocks: [], unlinkedReplies: [] };
    }

    const [blocks, events, members] = await Promise.all([
      ctx.db
        .query("availabilityBlocks")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("emailEvents")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
    ]);

    const memberById = new Map(members.map((member) => [member._id, member]));
    const inbound = events.filter(
      (event) =>
        event.direction === "inbound" && event.quote !== null && event.membershipId !== null,
    );
    const claimed = new Set<string>();

    const linkedBlocks = blocks.map((block): ConstraintRecord => {
      const member = memberById.get(block.membershipId);
      const wanted = block.sourceQuote === null ? null : normalizeQuote(block.sourceQuote);
      const match =
        wanted === null
          ? undefined
          : inbound.find(
              (event) =>
                !claimed.has(event._id) &&
                event.membershipId === block.membershipId &&
                event.quote !== null &&
                normalizeQuote(event.quote) === wanted,
            );

      if (match !== undefined) {
        claimed.add(match._id);
      }

      return {
        blockId: block._id,
        memberName: member === undefined ? "Unknown teammate" : member.displayName,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        reason: block.reason,
        sourceQuote: block.sourceQuote,
        reply: match === undefined ? null : toReplyRecord(match),
      };
    });

    linkedBlocks.sort((left, right) => left.startsAt - right.startsAt);

    return {
      blocks: linkedBlocks,
      unlinkedReplies: inbound
        .filter((event) => !claimed.has(event._id) && !event.handled)
        .map(toReplyRecord),
    };
  },
});

export const relevanceProvenance = query({
  args: { conferenceId: v.id("conferences"), limit: v.number() },
  handler: async (ctx, args): Promise<RelevanceSample> => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return { totalScores: 0, sample: [] };
    }

    const [scores, sessions, goals] = await Promise.all([
      ctx.db
        .query("sessionGoalScores")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
    ]);

    const sessionById = new Map(sessions.map((session) => [session._id, session]));
    const goalById = new Map(goals.map((goal) => [goal._id, goal]));

    const rows = scores.flatMap((score): RelevanceProvenance[] => {
      const session = sessionById.get(score.sessionId);
      const goal = goalById.get(score.goalId);

      if (session === undefined || goal === undefined) {
        return [];
      }

      return [
        {
          scoreId: score._id,
          sessionTitle: session.title,
          goalLabel: goal.label,
          relevance: score.relevance,
          reason: score.reason,
          model: score.model,
        },
      ];
    });

    rows.sort((left, right) =>
      right.relevance === left.relevance
        ? left.sessionTitle.localeCompare(right.sessionTitle)
        : right.relevance - left.relevance,
    );

    return {
      totalScores: rows.length,
      sample: rows.slice(0, Math.max(0, Math.trunc(args.limit))),
    };
  },
});
