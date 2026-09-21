import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { freshHarness } from "./fixtures";

it("holds every guard it attacks", async () => {
  const t = freshHarness();

  const proofs = await t.action(api.reliability.runReliabilityProofs, {});

  expect(proofs.map((proof) => proof.name)).toEqual([
    "Duplicate webhook",
    "Stale browser write",
    "Invented evidence",
    "Repeated send",
  ]);
  expect(proofs.filter((proof) => !proof.passed)).toEqual([]);
});

it("leaves nothing behind on the deployment it attacked", async () => {
  const t = freshHarness();

  await t.action(api.reliability.runReliabilityProofs, {});

  const leftovers = await t.run(async (ctx) => ({
    conferences: await ctx.db.query("conferences").collect(),
    teams: await ctx.db.query("teams").collect(),
    memberships: await ctx.db.query("memberships").collect(),
    events: await ctx.db.query("emailEvents").collect(),
    sends: await ctx.db.query("outboundSends").collect(),
  }));

  expect(leftovers.conferences).toHaveLength(0);
  expect(leftovers.teams).toHaveLength(0);
  expect(leftovers.memberships).toHaveLength(0);
  expect(leftovers.events).toHaveLength(0);
  expect(leftovers.sends).toHaveLength(0);
});
