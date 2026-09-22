import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

export const replyRetrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 2_000,
  base: 2,
  maxFailures: 3,
});
