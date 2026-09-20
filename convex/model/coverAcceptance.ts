import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { bumpConstraintRevision } from "../constraints";
import {
  assertNoOverlap,
  assertNotBlocked,
  ConflictError,
  requireCurrentPlan,
  sessionIsCovered,
  StaleRevisionError,
} from "./assignmentGuards";

export const coverRefusal = [
  "not_found",
  "not_open",
  "stale_plan",
  "session_gone",
  "member_gone",
  "unavailable",
  "overlap",
  "already_covered",
] as const;

export type CoverRefusal = (typeof coverRefusal)[number];

export interface CoverAccepted {
  readonly accepted: true;
  readonly reason: null;
  readonly detail: null;
  readonly duplicate: boolean;
  readonly constraintRevision: number;
  readonly memberName: string;
  readonly sessionTitle: string;
}

export interface CoverRefused {
  readonly accepted: false;
  readonly reason: CoverRefusal;
  readonly detail: string;
}

export type CoverAcceptance = CoverAccepted | CoverRefused;

export type CoverSource = "app" | "email";

function refuse(reason: CoverRefusal, detail: string): CoverRefused {
  return { accepted: false, reason, detail };
}

export async function openCoverRequestsFor(
  ctx: MutationCtx,
  conferenceId: Id<"conferences">,
  membershipId: Id<"memberships">,
): Promise<Doc<"coverRequests">[]> {
  const asked = await ctx.db
    .query("coverRequests")
    .withIndex("by_conference_status", (q) =>
      q.eq("conferenceId", conferenceId).eq("status", "asked"),
    )
    .collect();

  return asked.filter((request) => request.toMember === membershipId);
}

export async function applyCoverAcceptance(
  ctx: MutationCtx,
  requestId: Id<"coverRequests">,
  expectedRevision: number | null,
  source: CoverSource,
): Promise<CoverAcceptance> {
  const request = await ctx.db.get(requestId);

  if (request === null) {
    return refuse("not_found", "That cover request no longer exists.");
  }

  if (request.status !== "proposed" && request.status !== "asked") {
    return refuse(
      "not_open",
      request.status === "accepted"
        ? "That cover was already accepted. Nothing was changed."
        : "That cover request was already declined. Ask again to reopen it.",
    );
  }

  let plan: Doc<"plans">;

  try {
    ({ plan } = await requireCurrentPlan(ctx, request.planId, expectedRevision));
  } catch (error) {
    if (error instanceof StaleRevisionError) {
      return refuse("stale_plan", error.message);
    }

    throw error;
  }

  const session = await ctx.db.get(request.sessionId);

  if (session === null) {
    return refuse("session_gone", "That session is no longer on the agenda.");
  }

  const member = await ctx.db.get(request.toMember);

  if (member === null) {
    return refuse("member_gone", "That teammate is no longer on the team.");
  }

  let alreadyAssigned: boolean;

  try {
    await assertNotBlocked(ctx, request.conferenceId, request.toMember, session);
    ({ alreadyAssigned } = await assertNoOverlap(ctx, request.planId, request.toMember, session));
  } catch (error) {
    if (error instanceof ConflictError) {
      return refuse(error.kind, error.message);
    }

    throw error;
  }

  if (!alreadyAssigned && (await sessionIsCovered(ctx, request.planId, request.sessionId))) {
    return refuse(
      "already_covered",
      `"${session.title}" is already covered by someone else. Nothing was changed.`,
    );
  }

  if (!alreadyAssigned) {
    await ctx.db.insert("assignments", {
      planId: request.planId,
      conferenceId: request.conferenceId,
      sessionId: request.sessionId,
      membershipId: request.toMember,
      pinned: false,
      reason: `Covering after a teammate dropped out, +${request.coverageGain.toFixed(1)} Team Goal Coverage`,
    });
  }

  await ctx.db.patch(requestId, { status: "accepted" });

  const constraintRevision = await bumpConstraintRevision(ctx, request.conferenceId);
  await ctx.db.patch(plan._id, { computedAtRevision: constraintRevision });

  if (!alreadyAssigned) {
    await ctx.db.insert("activity", {
      conferenceId: request.conferenceId,
      kind: "cover_accepted",
      sponsor: "agentmail",
      durationMs: 0,
      summary:
        source === "email"
          ? `${member.displayName} replied YES and now covers "${session.title}". 1 person moved.`
          : `${member.displayName} accepted cover for "${session.title}". 1 person moved.`,
    });
  }

  return {
    accepted: true,
    reason: null,
    detail: null,
    duplicate: alreadyAssigned,
    constraintRevision,
    memberName: member.displayName,
    sessionTitle: session.title,
  };
}

export async function declineCoverRequest(
  ctx: MutationCtx,
  requestId: Id<"coverRequests">,
): Promise<{ declined: boolean; reason: CoverRefusal | null }> {
  const request = await ctx.db.get(requestId);

  if (request === null) {
    return { declined: false, reason: "not_found" };
  }

  if (request.status !== "proposed" && request.status !== "asked") {
    return { declined: false, reason: "not_open" };
  }

  await ctx.db.patch(requestId, { status: "declined" });
  return { declined: true, reason: null };
}
