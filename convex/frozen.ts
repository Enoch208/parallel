import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { frozenMessage, isFrozen } from "./model/frozenConference";

export const frozenState = internalQuery({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<boolean> => isFrozen(ctx, args.conferenceId),
});

export const setFrozen = internalMutation({
  args: { conferenceId: v.id("conferences"), frozen: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conferenceId, { frozen: args.frozen });
    return { frozen: args.frozen };
  },
});

export async function assertWritableFromAction(
  ctx: ActionCtx,
  conferenceId: Id<"conferences">,
): Promise<void> {
  if (await ctx.runQuery(internal.frozen.frozenState, { conferenceId })) {
    throw new ConvexError(frozenMessage);
  }
}
