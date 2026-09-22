import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { requireVisitorKey } from "./visitorKey";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  briefGeneration: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
  judgeDemo: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  agendaImport: { kind: "token bucket", rate: 3, period: HOUR, capacity: 2 },
  judgeEmail: { kind: "fixed window", rate: 3, period: 10 * MINUTE },
});

export type RateLimited = {
  kind: "rate_limited";
  message: string;
  retryAfterMs: number;
};

export function rateLimited(what: string, retryAfterMs: number): ConvexError<RateLimited> {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  const data: RateLimited = {
    kind: "rate_limited",
    message: `${what} Try again in ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`,
    retryAfterMs,
  };
  return new ConvexError(data);
}

export async function admitVisitor(
  ctx: MutationCtx | ActionCtx,
  name: "judgeDemo" | "agendaImport",
  visitorKey: string,
  refusal: string,
): Promise<void> {
  const allowance = await rateLimiter.limit(ctx, name, { key: requireVisitorKey(visitorKey) });

  if (!allowance.ok) {
    throw rateLimited(refusal, allowance.retryAfter);
  }
}
