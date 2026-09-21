import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const frozenMessage =
  "This is the verified production run. It is kept exactly as it happened, so nothing on it can be changed. Run the demo on the Judges screen for a workspace of your own.";

export async function isFrozen(ctx: QueryCtx, conferenceId: Id<"conferences">): Promise<boolean> {
  const conference = await ctx.db.get(conferenceId);
  return conference?.frozen === true;
}

export async function assertWritable(
  ctx: QueryCtx,
  conferenceId: Id<"conferences">,
): Promise<void> {
  if (await isFrozen(ctx, conferenceId)) {
    throw new ConvexError(frozenMessage);
  }
}
