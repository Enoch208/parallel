import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { freshHarness } from "./fixtures";

async function planWithAnAssignedSessionCancelled() {
  const t = freshHarness();
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});
  await t.mutation(api.plan.optimize, { conferenceId });

  const before = await t.query(api.board.latestPlan, { conferenceId });
  const cancelled = before?.assignments.at(0)?.sessionId as Id<"sessions"> | undefined;

  if (before === null || cancelled === undefined) {
    throw new Error("The demo workspace produced no assignment to cancel");
  }

  await t.run(async (ctx) => {
    await ctx.db.patch(cancelled, { cancelledAt: Date.now() });
    const conference = await ctx.db.get(conferenceId);
    await ctx.db.patch(conferenceId, {
      constraintRevision: (conference?.constraintRevision ?? 0) + 1,
    });
  });

  return { t, conferenceId, cancelled };
}

it("never assigns anyone to a session the organizer cancelled", async () => {
  const { t, conferenceId, cancelled } = await planWithAnAssignedSessionCancelled();

  await t.mutation(api.plan.optimize, { conferenceId });
  const plan = await t.query(api.board.latestPlan, { conferenceId });

  expect(plan?.assignments.map((row) => row.sessionId)).not.toContain(cancelled);
});

it("repairs a plan whose assigned session was cancelled, without failing", async () => {
  const { t, conferenceId, cancelled } = await planWithAnAssignedSessionCancelled();

  const outcome = await t.mutation(api.plan.repair, { conferenceId });
  const plan = await t.query(api.board.latestPlan, { conferenceId });

  expect(outcome.kind).toBe("plan");
  expect(plan?.assignments.map((row) => row.sessionId)).not.toContain(cancelled);
});

it("marks a cancelled session so the board can say so", async () => {
  const { t, conferenceId, cancelled } = await planWithAnAssignedSessionCancelled();

  const sessions = await t.query(api.board.conferenceSessions, { conferenceId });
  const row = sessions.find((session) => session.id === cancelled);

  expect(row?.cancelled).toBe(true);
});
