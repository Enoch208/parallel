import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { BASE, HOUR, freshHarness, seedCoverScenario } from "./fixtures";

it("reports coverage from the saved repair while leaving new cover assignments for consent", async () => {
  const t = freshHarness();
  const fixture = await t.run(async (ctx) => {
    const seeded = await seedCoverScenario(ctx);
    await ctx.db.patch(seeded.planId, { computedAt: 0 });
    const goalId = await ctx.db.insert("goals", {
      conferenceId: seeded.conferenceId,
      label: "Reliable workflows",
      weight: 5,
    });
    for (const [sessionId, membershipId, relevance] of [
      [seeded.droppedSessionId, seeded.leaverId, 1],
      [seeded.clashingSessionId, seeded.bystanderId, 0.2],
    ] as const) {
      await ctx.db.insert("sessionGoalScores", {
        conferenceId: seeded.conferenceId,
        sessionId,
        goalId,
        relevance,
        reason: "Fixture relevance",
        model: "test",
      });
      await ctx.db.insert("assignments", {
        conferenceId: seeded.conferenceId,
        planId: seeded.planId,
        sessionId,
        membershipId,
        pinned: false,
        reason: "Previously agreed",
      });
    }
    return seeded;
  });

  await t.mutation(api.constraints.applyAvailabilityBlock, {
    conferenceId: fixture.conferenceId,
    membershipId: fixture.leaverId,
    startsAt: BASE,
    endsAt: BASE + HOUR,
    reason: "Customer call",
    sourceQuote: "I cannot make this session",
  });
  const repair = await t.mutation(api.plan.repair, { conferenceId: fixture.conferenceId });
  const coverage = await t.query(api.plan.coverage, { conferenceId: fixture.conferenceId });
  const { assignments, activity, plan } = await t.run(async (ctx) => ({
    assignments: await ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", repair.planId))
      .collect(),
    activity: await ctx.db
      .query("activity")
      .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
      .collect(),
    plan: await ctx.db.get(repair.planId),
  }));

  expect(assignments).toHaveLength(1);
  expect(assignments[0]).toMatchObject({
    membershipId: fixture.bystanderId,
    sessionId: fixture.clashingSessionId,
  });
  expect(plan?.minimumChangedMembers).toBe(1);
  expect(plan?.mustChangeMemberIds).toEqual([fixture.leaverId]);
  expect(coverage?.teamGoalCoverage).toBeCloseTo(15);
  expect(activity.find((event) => event.kind === "plan_repaired")?.summary).toBe(
    "1 moved, Team Goal Coverage 15",
  );
});
