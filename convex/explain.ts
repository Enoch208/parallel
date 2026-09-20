import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { AssignmentExplanation, SessionExplanation } from "./engine/counterfactual";
import { explainAssignment, explainSession } from "./engine/counterfactual";
import { loadOptimizerInput } from "./model/loadOptimizerInput";
import type { AssignmentSummary } from "./model/types";

export interface PlanContext {
  readonly planId: string;
  readonly computedAt: number;
  readonly computedAtRevision: number;
  readonly conferenceRevision: number;
  readonly isStale: boolean;
}

export interface AssignmentExplanationResult {
  readonly plan: PlanContext;
  readonly assignmentId: string | null;
  readonly explanation: AssignmentExplanation;
}

export interface SessionExplanationResult {
  readonly plan: PlanContext;
  readonly explanation: SessionExplanation;
}

interface PlanSnapshot {
  readonly conference: Doc<"conferences">;
  readonly plan: Doc<"plans">;
  readonly assignments: readonly Doc<"assignments">[];
}

async function loadLatestPlan(
  ctx: QueryCtx,
  conferenceId: Id<"conferences">,
): Promise<PlanSnapshot | null> {
  const conference = await ctx.db.get(conferenceId);

  if (conference === null) {
    return null;
  }

  const plan = await ctx.db
    .query("plans")
    .withIndex("by_conference_computed", (q) => q.eq("conferenceId", conferenceId))
    .order("desc")
    .first();

  if (plan === null) {
    return null;
  }

  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_plan", (q) => q.eq("planId", plan._id))
    .collect();

  return { conference, plan, assignments };
}

function planContext(snapshot: PlanSnapshot): PlanContext {
  return {
    planId: snapshot.plan._id,
    computedAt: snapshot.plan.computedAt,
    computedAtRevision: snapshot.plan.computedAtRevision,
    conferenceRevision: snapshot.conference.constraintRevision,
    isStale: snapshot.plan.computedAtRevision !== snapshot.conference.constraintRevision,
  };
}

function toAssignmentSummaries(assignments: readonly Doc<"assignments">[]): AssignmentSummary[] {
  return assignments.map((assignment) => ({
    sessionId: assignment.sessionId,
    membershipId: assignment.membershipId,
    pinned: assignment.pinned,
    reason: assignment.reason,
  }));
}

export const assignment = query({
  args: {
    conferenceId: v.id("conferences"),
    assignmentId: v.optional(v.id("assignments")),
    membershipId: v.optional(v.id("memberships")),
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args): Promise<AssignmentExplanationResult | null> => {
    const snapshot = await loadLatestPlan(ctx, args.conferenceId);

    if (snapshot === null) {
      return null;
    }

    const chosen =
      args.assignmentId === undefined
        ? snapshot.assignments.find(
            (entry) =>
              entry.membershipId === args.membershipId && entry.sessionId === args.sessionId,
          )
        : snapshot.assignments.find((entry) => entry._id === args.assignmentId);

    if (chosen === undefined) {
      return null;
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, snapshot.conference.agendaUrl);

    return {
      plan: planContext(snapshot),
      assignmentId: chosen._id,
      explanation: explainAssignment(
        input,
        toAssignmentSummaries(snapshot.assignments),
        chosen.membershipId,
        chosen.sessionId,
      ),
    };
  },
});

export const session = query({
  args: { conferenceId: v.id("conferences"), sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<SessionExplanationResult | null> => {
    const snapshot = await loadLatestPlan(ctx, args.conferenceId);

    if (snapshot === null) {
      return null;
    }

    const target = await ctx.db.get(args.sessionId);

    if (target === null || target.conferenceId !== args.conferenceId) {
      return null;
    }

    const input = await loadOptimizerInput(ctx, args.conferenceId, snapshot.conference.agendaUrl);

    return {
      plan: planContext(snapshot),
      explanation: explainSession(
        input,
        toAssignmentSummaries(snapshot.assignments),
        args.sessionId,
      ),
    };
  },
});
