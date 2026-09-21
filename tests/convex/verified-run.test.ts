import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { freshHarness } from "./fixtures";

async function realLookingWorkspace() {
  const t = freshHarness();
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});
  await t.mutation(api.plan.optimize, { conferenceId });
  await t.run(async (ctx) => ctx.db.patch(conferenceId, { isDemoData: false }));
  return { t, conferenceId };
}

it("reports the same before and after coverage as the brief's trip summary", async () => {
  const { t, conferenceId } = await realLookingWorkspace();

  const run = await t.query(api.verifiedRun.verifiedRun, { conferenceId });
  const latest = await t.query(api.brief.latest, { conferenceId });

  expect(run?.coverageBefore).toBe(latest?.tripSummary.coverageBefore);
  expect(run?.coverageAfter).toBe(latest?.tripSummary.coverageAfter);
  expect(run?.sessionsCovered).toBe(latest?.tripSummary.sessionsUniquelyCovered);
  expect(run?.peopleMovedByRepair).toBeNull();
  expect(run?.briefDelivered).toBe(false);
});

it("shows nothing for an id this deployment does not have", async () => {
  const t = freshHarness();

  expect(await t.query(api.verifiedRun.verifiedRun, { conferenceId: "not-a-real-id" })).toBeNull();
});

it("never presents a demo workspace as the verified run", async () => {
  const t = freshHarness();
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});

  expect(await t.query(api.verifiedRun.verifiedRun, { conferenceId })).toBeNull();
});
