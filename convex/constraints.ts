import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function bumpConstraintRevision(
  ctx: MutationCtx,
  conferenceId: Id<"conferences">,
): Promise<number> {
  const conference = await ctx.db.get(conferenceId);

  if (conference === null) {
    throw new Error("Conference not found");
  }

  const next = conference.constraintRevision + 1;
  await ctx.db.patch(conferenceId, { constraintRevision: next });
  return next;
}

export const applyAvailabilityBlock = mutation({
  args: {
    conferenceId: v.id("conferences"),
    membershipId: v.id("memberships"),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.string(),
    sourceQuote: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    if (args.endsAt <= args.startsAt) {
      throw new Error("A block must end after it starts");
    }

    const member = await ctx.db.get(args.membershipId);

    if (member === null) {
      throw new Error("Teammate not found");
    }

    const blockId = await ctx.db.insert("availabilityBlocks", {
      conferenceId: args.conferenceId,
      membershipId: args.membershipId,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      reason: args.reason,
      sourceQuote: args.sourceQuote,
    });

    const revision = await bumpConstraintRevision(ctx, args.conferenceId);

    await ctx.db.insert("activity", {
      conferenceId: args.conferenceId,
      kind: "constraint_added",
      sponsor: "convex",
      durationMs: 0,
      summary: `${member.displayName} cannot make a session: ${args.reason}`,
    });

    return { blockId, constraintRevision: revision };
  },
});

export const releaseAvailabilityBlock = mutation({
  args: { blockId: v.id("availabilityBlocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId);

    if (block === null) {
      return { removed: false };
    }

    await ctx.db.delete(args.blockId);
    const revision = await bumpConstraintRevision(ctx, block.conferenceId);

    await ctx.db.insert("activity", {
      conferenceId: block.conferenceId,
      kind: "constraint_removed",
      sponsor: "convex",
      durationMs: 0,
      summary: "A teammate undid their block",
    });

    return { removed: true, constraintRevision: revision };
  },
});
