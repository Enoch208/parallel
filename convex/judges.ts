import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export interface JudgeStep {
  readonly label: string;
  readonly detail: string;
  readonly coverage: number | null;
  readonly uniqueSessions: number | null;
  readonly duplicateAttendances: number | null;
}

export interface JudgeRun {
  readonly conferenceId: Id<"conferences">;
  readonly steps: readonly JudgeStep[];
  readonly coverSessionTitle: string | null;
  readonly coverCandidate: string | null;
  readonly coverReasons: readonly string[];
}

export const runDemo = action({
  args: {},
  handler: async (ctx): Promise<JudgeRun> => {
    const conferenceId = await ctx.runMutation(api.demo.seedDemoWorkspace, {});
    const steps: JudgeStep[] = [];

    const snapshot = async (label: string, detail: string): Promise<void> => {
      const coverage = await ctx.runQuery(api.plan.coverage, { conferenceId });

      steps.push({
        label,
        detail,
        coverage: coverage === null ? null : Math.round(coverage.teamGoalCoverage * 10) / 10,
        uniqueSessions: coverage === null ? null : coverage.uniqueSessions,
        duplicateAttendances: coverage === null ? null : coverage.duplicateAttendances,
      });
    };

    await ctx.runMutation(api.plan.naturalPlan, { conferenceId });
    await snapshot("Everyone plans alone", "Four teammates chose the same famous sessions.");

    await ctx.runMutation(api.plan.optimize, { conferenceId });
    await snapshot("Optimize", "A deterministic optimizer splits the team across the tracks.");

    const dropped = await ctx.runMutation(internal.judges.dropOneTeammate, { conferenceId });

    if (!dropped.dropped) {
      return {
        conferenceId,
        steps,
        coverSessionTitle: null,
        coverCandidate: null,
        coverReasons: [],
      };
    }

    await snapshot(
      "A teammate replies",
      `${dropped.memberName} cannot make "${dropped.sessionTitle}" any more.`,
    );

    await ctx.runMutation(api.plan.repair, { conferenceId });
    await snapshot(
      "Repair",
      "Only the teammate who replied is moved. Their session is left open rather than silently refilled, and coverage falls only by what that session alone added.",
    );

    const proposal = await ctx.runMutation(api.cover.proposeCover, {
      conferenceId,
      sessionId: dropped.sessionId,
      fromMember: dropped.membershipId,
    });

    return {
      conferenceId,
      steps,
      coverSessionTitle: dropped.sessionTitle,
      coverCandidate: proposal.candidate === null ? null : proposal.candidate.displayName,
      coverReasons: proposal.candidate === null ? [] : proposal.candidate.reasons,
    };
  },
});

export const dropOneTeammate = internalMutation({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    if (plan === null) {
      return { dropped: false as const };
    }

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    const counts = new Map<string, number>();

    for (const assignment of assignments) {
      counts.set(assignment.sessionId, (counts.get(assignment.sessionId) ?? 0) + 1);
    }

    const sessionRows = await ctx.db
      .query("sessions")
      .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
      .collect();

    const sessionById = new Map(sessionRows.map((row) => [row._id as string, row]));
    const conferenceRow = await ctx.db.get(args.conferenceId);

    if (conferenceRow === null) {
      return { dropped: false as const };
    }

    const members = await ctx.db
      .query("memberships")
      .withIndex("by_team", (q) => q.eq("teamId", conferenceRow.teamId))
      .collect();

    const candidates = assignments
      .filter((assignment) => !assignment.pinned && counts.get(assignment.sessionId) === 1)
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId));

    const solo = candidates.find((assignment) => {
      const session = sessionById.get(assignment.sessionId);

      if (session === undefined) {
        return false;
      }

      return members.some((member) => {
        if (member._id === assignment.membershipId) {
          return false;
        }

        return !assignments.some((other) => {
          if (other.membershipId !== member._id) {
            return false;
          }

          const otherSession = sessionById.get(other.sessionId);

          return (
            otherSession !== undefined &&
            otherSession.startsAt < session.endsAt &&
            session.startsAt < otherSession.endsAt
          );
        });
      });
    });

    if (solo === undefined) {
      return { dropped: false as const };
    }

    const [session, member] = await Promise.all([
      ctx.db.get(solo.sessionId),
      ctx.db.get(solo.membershipId),
    ]);

    if (session === null || member === null) {
      return { dropped: false as const };
    }

    await ctx.db.insert("availabilityBlocks", {
      conferenceId: args.conferenceId,
      membershipId: solo.membershipId,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      reason: "customer lunch",
      sourceQuote: "cant make the 2pm, customer lunch",
    });

    await ctx.db.patch(args.conferenceId, {
      constraintRevision: conferenceRow.constraintRevision + 1,
    });

    return {
      dropped: true as const,
      sessionId: solo.sessionId,
      membershipId: solo.membershipId,
      memberName: member.displayName,
      sessionTitle: session.title,
    };
  },
});
