import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { freshHarness } from "./fixtures";

it("does not count a takeaway the lead rejected as captured", async () => {
  const t = freshHarness();
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});
  await t.mutation(api.plan.optimize, { conferenceId });
  const plan = await t.query(api.board.latestPlan, { conferenceId });
  const assignment = plan?.assignments.at(0);

  if (assignment === undefined) {
    throw new Error("The demo workspace produced no assignment to write a takeaway against");
  }

  await t.run(async (ctx) => {
    const shared = {
      conferenceId,
      sessionId: assignment.sessionId as Id<"sessions">,
      membershipId: assignment.membershipId as Id<"memberships">,
      source: "email" as const,
    };
    await ctx.db.insert("notes", { ...shared, body: "Their pilot ran on one unit for a month." });
    await ctx.db.insert("notes", { ...shared, body: "Takeaway from", approved: false });
  });

  const latest = await t.query(api.brief.latest, { conferenceId });

  expect(latest?.tripSummary.takeawaysCaptured).toBe(1);
  expect(latest?.tripSummary.sessionsWithTakeaways).toBe(1);
});
