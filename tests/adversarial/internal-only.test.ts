import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

it("keeps raw inbound email rows behind an internal query", () => {
  expect(source("../../convex/emailReplies.ts")).toContain(
    "export const pendingReplies = internalQuery(",
  );
});

it("keeps the list of expired demo workspaces behind an internal query", () => {
  expect(source("../../convex/guest.ts")).toContain(
    "export const expiredGuestWorkspaces = internalQuery(",
  );
});
