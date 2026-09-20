import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { overlaps } from "../engine";

export class StaleRevisionError extends Error {}
export type ConflictKind = "unavailable" | "overlap";

export class ConflictError extends Error {
  readonly kind: ConflictKind;

  constructor(kind: ConflictKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface CurrentPlan {
  readonly plan: Doc<"plans">;
  readonly conference: Doc<"conferences">;
}

export async function requireCurrentPlan(
  ctx: MutationCtx,
  planId: Id<"plans">,
  expectedRevision: number | null,
): Promise<CurrentPlan> {
  const plan = await ctx.db.get(planId);

  if (plan === null) {
    throw new Error("That plan no longer exists");
  }

  const conference = await ctx.db.get(plan.conferenceId);

  if (conference === null) {
    throw new Error("Conference not found");
  }

  if (expectedRevision !== null && conference.constraintRevision !== expectedRevision) {
    throw new StaleRevisionError(
      "The plan changed while you were looking at it. Reload the board and try again.",
    );
  }

  if (plan.computedAtRevision !== conference.constraintRevision) {
    throw new StaleRevisionError(
      "This plan is out of date with the team's constraints. Repair it before changing assignments.",
    );
  }

  return { plan, conference };
}

export async function requireSession(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
): Promise<Doc<"sessions">> {
  const session = await ctx.db.get(sessionId);

  if (session === null) {
    throw new Error("That session is no longer on the agenda");
  }

  return session;
}

export async function assertNotBlocked(
  ctx: MutationCtx,
  conferenceId: Id<"conferences">,
  membershipId: Id<"memberships">,
  session: Doc<"sessions">,
): Promise<void> {
  const blocks = await ctx.db
    .query("availabilityBlocks")
    .withIndex("by_member", (q) =>
      q.eq("conferenceId", conferenceId).eq("membershipId", membershipId),
    )
    .collect();

  const clash = blocks.find((block) => overlaps(block, session));

  if (clash !== undefined) {
    throw new ConflictError(
      "unavailable",
      `That teammate is unavailable then: ${clash.reason}. Nothing was changed.`,
    );
  }
}

export interface OverlapCheck {
  readonly alreadyAssigned: boolean;
}

export async function assertNoOverlap(
  ctx: MutationCtx,
  planId: Id<"plans">,
  membershipId: Id<"memberships">,
  session: Doc<"sessions">,
): Promise<OverlapCheck> {
  const existing = await ctx.db
    .query("assignments")
    .withIndex("by_plan_member", (q) => q.eq("planId", planId).eq("membershipId", membershipId))
    .collect();

  if (existing.some((assignment) => assignment.sessionId === session._id)) {
    return { alreadyAssigned: true };
  }

  for (const assignment of existing) {
    const other = await ctx.db.get(assignment.sessionId);

    if (other !== null && overlaps(other, session)) {
      throw new ConflictError(
        "overlap",
        `That clashes with "${other.title}" at the same time. Nothing was changed.`,
      );
    }
  }

  return { alreadyAssigned: false };
}

export async function sessionIsCovered(
  ctx: MutationCtx,
  planId: Id<"plans">,
  sessionId: Id<"sessions">,
): Promise<boolean> {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  return rows.some((row) => row.planId === planId);
}
