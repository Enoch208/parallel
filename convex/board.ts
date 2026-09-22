import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { AssignmentSummary, GoalSummary, PlanStatus, SessionSummary } from "./model/types";
import { shownAddress } from "./model/privacy";

export type PreferenceStance = Doc<"memberPreferences">["stance"];

export interface ConferenceHeader {
  readonly id: string;
  readonly name: string;
  readonly teamName: string;
  readonly agendaUrl: string;
  readonly timezone: string;
  readonly constraintRevision: number;
  readonly isDemoData: boolean;
  readonly frozen: boolean;
}

export interface TeamMemberSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly isLead: boolean;
}

export interface ConferenceOverview {
  readonly conference: ConferenceHeader;
  readonly goals: readonly GoalSummary[];
  readonly members: readonly TeamMemberSummary[];
}

export interface PlanWithAssignments {
  readonly id: string;
  readonly status: PlanStatus;
  readonly computedAt: number;
  readonly computedAtRevision: number;
  readonly conferenceRevision: number;
  readonly isStale: boolean;
  readonly blockingPins: readonly string[];
  readonly solverStatus: "optimal" | "heuristic" | null;
  readonly objective: number | null;
  readonly upperBound: number | null;
  readonly nodesExplored: number | null;
  readonly minimumChangedMembers: number | null;
  readonly mustChangeMemberIds: readonly string[];
  readonly assignments: readonly AssignmentSummary[];
}

export interface MemberPreference {
  readonly sessionId: string;
  readonly stance: PreferenceStance;
}

export interface MemberPreferences {
  readonly member: TeamMemberSummary;
  readonly preferences: readonly MemberPreference[];
}

const toMemberSummary = (doc: Doc<"memberships">, hideEmail: boolean): TeamMemberSummary => ({
  id: doc._id,
  displayName: doc.displayName,
  email: shownAddress(doc.email, hideEmail),
  isLead: doc.isLead,
});

const toGoalSummary = (doc: Doc<"goals">): GoalSummary => ({
  id: doc._id,
  label: doc.label,
  weight: doc.weight,
});

const toSessionSummary = (doc: Doc<"sessions">, sourceUrl: string): SessionSummary => ({
  id: doc._id,
  title: doc.title,
  track: doc.track,
  room: doc.room,
  speakers: doc.speakers,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  sourceUrl,
  titleConfidence: doc.titleConfidence,
  timeConfidence: doc.timeConfidence,
  roomConfidence: doc.roomConfidence,
});

export const conferenceOverview = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<ConferenceOverview | null> => {
    const conference = await ctx.db.get(args.conferenceId);
    if (conference === null) {
      return null;
    }
    const [team, goals, members] = await Promise.all([
      ctx.db.get(conference.teamId),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
    ]);
    if (team === null) {
      return null;
    }
    return {
      conference: {
        id: conference._id,
        name: conference.name,
        teamName: team.name,
        agendaUrl: conference.agendaUrl,
        timezone: conference.timezone,
        constraintRevision: conference.constraintRevision,
        isDemoData: conference.isDemoData,
        frozen: conference.frozen === true,
      },
      goals: goals.map(toGoalSummary),
      members: members.map((member) => toMemberSummary(member, conference.frozen === true)),
    };
  },
});

export interface BoardSession extends SessionSummary {
  readonly cancelled: boolean;
}

export const conferenceSessions = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<readonly BoardSession[]> => {
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
    const urlBySourceId = new Map(sources.map((source) => [source._id, source.url]));
    return sessions.map((session) => ({
      ...toSessionSummary(session, urlBySourceId.get(session.sourceId) ?? conference.agendaUrl),
      cancelled: session.cancelledAt !== undefined,
    }));
  },
});

export const latestPlan = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<PlanWithAssignments | null> => {
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
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();
    return {
      id: plan._id,
      status: plan.status,
      solverStatus: plan.solverStatus ?? null,
      objective: plan.objective ?? null,
      upperBound: plan.upperBound ?? null,
      nodesExplored: plan.nodesExplored ?? null,
      minimumChangedMembers: plan.minimumChangedMembers ?? null,
      mustChangeMemberIds: plan.mustChangeMemberIds ?? [],
      computedAt: plan.computedAt,
      computedAtRevision: plan.computedAtRevision,
      conferenceRevision: conference.constraintRevision,
      isStale: plan.computedAtRevision !== conference.constraintRevision,
      blockingPins: plan.blockingPins,
      assignments: assignments.map((assignment) => ({
        sessionId: assignment.sessionId,
        membershipId: assignment.membershipId,
        pinned: assignment.pinned,
        reason: assignment.reason,
      })),
    };
  },
});

export const memberPreferences = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<readonly MemberPreferences[]> => {
    const conference = await ctx.db.get(args.conferenceId);
    if (conference === null) {
      return [];
    }
    const [members, preferences] = await Promise.all([
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
      ctx.db
        .query("memberPreferences")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conference._id))
        .collect(),
    ]);
    const byMembershipId = new Map<string, MemberPreference[]>();
    for (const preference of preferences) {
      const existing = byMembershipId.get(preference.membershipId);
      const entry = { sessionId: preference.sessionId, stance: preference.stance };
      if (existing === undefined) {
        byMembershipId.set(preference.membershipId, [entry]);
      } else {
        existing.push(entry);
      }
    }
    return members.map((member) => ({
      member: toMemberSummary(member, conference.frozen === true),
      preferences: byMembershipId.get(member._id) ?? [],
    }));
  },
});
