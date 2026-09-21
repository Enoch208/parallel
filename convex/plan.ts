import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  computeCoverageSummary,
  countMovedAssignments,
  optimizePlanWithProof,
  repairPlan,
  repairWithMinimumDisruption,
} from "./engine";
import { loadOptimizerInput } from "./model/loadOptimizerInput";
import { naturalAssignments } from "./model/naturalPlan";
import type { AssignmentSummary } from "./model/types";

export const optimize = mutation({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, conference.agendaUrl);
    const outcome = optimizePlanWithProof(input);

    const planId = await ctx.db.insert("plans", {
      conferenceId: args.conferenceId,
      computedAtRevision: conference.constraintRevision,
      status: outcome.kind === "infeasible" ? "infeasible" : "published",
      blockingPins:
        outcome.kind === "infeasible"
          ? outcome.blockingPinnedSessionIds.map((id) => id as Id<"sessions">)
          : [],
      computedAt: Date.now(),
      ...(outcome.kind === "plan"
        ? {
            solverStatus: outcome.status,
            objective: outcome.objective.objective,
            upperBound: outcome.upperBound,
            nodesExplored: outcome.nodesExplored,
          }
        : {}),
    });

    if (outcome.kind === "plan") {
      for (const assignment of outcome.assignments) {
        await ctx.db.insert("assignments", {
          planId,
          conferenceId: args.conferenceId,
          sessionId: assignment.sessionId as Id<"sessions">,
          membershipId: assignment.membershipId as Id<"memberships">,
          pinned: assignment.pinned,
          reason: assignment.reason,
        });
      }
    }

    await ctx.db.insert("activity", {
      conferenceId: args.conferenceId,
      kind: "plan_optimized",
      sponsor: "convex",
      durationMs: 0,
      summary:
        outcome.kind === "infeasible"
          ? `No plan fits: ${String(outcome.blockingPinnedSessionIds.length)} pinned sessions conflict`
          : `Team Goal Coverage ${String(Math.round(outcome.coverage.teamGoalCoverage))}, ${String(outcome.coverage.uniqueSessions)} unique sessions`,
    });

    return { planId, kind: outcome.kind };
  },
});

async function latestPlanAssignments(
  ctx: QueryCtx | MutationCtx,
  conferenceId: Id<"conferences">,
): Promise<{ assignments: AssignmentSummary[] } | null> {
  const plan = await ctx.db
    .query("plans")
    .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conferenceId))
    .order("desc")
    .first();

  if (plan === null) {
    return null;
  }

  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_plan", (q) => q.eq("planId", plan._id))
    .collect();

  return {
    assignments: rows.map((row) => ({
      sessionId: row.sessionId,
      membershipId: row.membershipId,
      pinned: row.pinned,
      reason: row.reason,
    })),
  };
}

function withoutUnconsentedMoves(
  outcome: ReturnType<typeof repairPlan>,
  previous: readonly AssignmentSummary[],
): ReturnType<typeof repairPlan> {
  if (outcome.kind !== "plan") {
    return outcome;
  }

  const held = new Set(previous.map((entry) => `${entry.membershipId}:${entry.sessionId}`));

  return {
    ...outcome,
    assignments: outcome.assignments.filter((entry) =>
      held.has(`${entry.membershipId}:${entry.sessionId}`),
    ),
  };
}

export const coverage = query({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      return null;
    }

    const plan = await ctx.db
      .query("plans")
      .withIndex("by_conference_computed", (q) => q.eq("conferenceId", args.conferenceId))
      .order("desc")
      .first();

    if (plan === null) {
      return null;
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, conference.agendaUrl);
    const rows = await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    return computeCoverageSummary(
      input,
      rows.map((row) => ({
        sessionId: row.sessionId,
        membershipId: row.membershipId,
        pinned: row.pinned,
        reason: row.reason,
      })),
    );
  },
});

export const naturalPlan = mutation({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, conference.agendaUrl);
    const assignments = naturalAssignments(input);

    const planId = await ctx.db.insert("plans", {
      conferenceId: args.conferenceId,
      computedAtRevision: conference.constraintRevision,
      status: "draft",
      blockingPins: [],
      computedAt: Date.now(),
    });

    for (const assignment of assignments) {
      await ctx.db.insert("assignments", {
        planId,
        conferenceId: args.conferenceId,
        sessionId: assignment.sessionId as Id<"sessions">,
        membershipId: assignment.membershipId as Id<"memberships">,
        pinned: assignment.pinned,
        reason: assignment.reason,
      });
    }

    return { planId, assignments: assignments.length };
  },
});

export const repair = mutation({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args) => {
    const conference = await ctx.db.get(args.conferenceId);

    if (conference === null) {
      throw new Error("Conference not found");
    }

    const previous = await latestPlanAssignments(ctx, args.conferenceId);

    if (previous === null) {
      throw new Error("There is no plan to repair");
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, conference.agendaUrl);
    const disruption = repairWithMinimumDisruption(input, previous.assignments);
    const proposed = repairPlan(input, previous.assignments);
    const outcome = withoutUnconsentedMoves(proposed, previous.assignments);
    const moved =
      outcome.kind === "plan"
        ? countMovedAssignments(input.sessions, previous.assignments, outcome.assignments)
        : 0;

    const planId = await ctx.db.insert("plans", {
      conferenceId: args.conferenceId,
      computedAtRevision: conference.constraintRevision,
      status: outcome.kind === "infeasible" ? "infeasible" : "published",
      blockingPins:
        outcome.kind === "infeasible"
          ? outcome.blockingPinnedSessionIds.map((id) => id as Id<"sessions">)
          : [],
      computedAt: Date.now(),
      ...(disruption.kind === "plan"
        ? {
            minimumChangedMembers: disruption.minimumChangedMembers,
            mustChangeMemberIds: disruption.mustChangeMemberIds.map(
              (id) => id as Id<"memberships">,
            ),
          }
        : {}),
    });

    if (outcome.kind === "plan") {
      for (const assignment of outcome.assignments) {
        await ctx.db.insert("assignments", {
          planId,
          conferenceId: args.conferenceId,
          sessionId: assignment.sessionId as Id<"sessions">,
          membershipId: assignment.membershipId as Id<"memberships">,
          pinned: assignment.pinned,
          reason: assignment.reason,
        });
      }
    }

    await ctx.db.insert("activity", {
      conferenceId: args.conferenceId,
      kind: "plan_repaired",
      sponsor: "convex",
      durationMs: 0,
      summary:
        outcome.kind === "infeasible"
          ? "No repair fits the pinned sessions"
          : `${String(moved)} moved, Team Goal Coverage ${String(Math.round(computeCoverageSummary(input, outcome.assignments).teamGoalCoverage))}`,
    });

    return { planId, kind: outcome.kind, moved };
  },
});
