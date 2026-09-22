import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  briefGeneration: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
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
