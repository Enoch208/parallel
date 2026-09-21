import { ConvexError } from "convex/values";
import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { StaleRevisionError } from "../../convex/model/assignmentGuards";
import { freshHarness } from "./fixtures";

const refusal = /verified production run/;

async function frozenWorkspace() {
  const t = freshHarness();
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});
  await t.mutation(api.plan.optimize, { conferenceId });
  const plan = await t.query(api.board.latestPlan, { conferenceId });
  const assignment = plan?.assignments.at(0);

  if (plan === null || assignment === undefined) {
    throw new Error("The demo workspace produced no plan to freeze");
  }

  await t.mutation(internal.frozen.setFrozen, { conferenceId, frozen: true });

  return {
    t,
    conferenceId,
    planId: plan.id as Id<"plans">,
    revision: plan.conferenceRevision,
    sessionId: assignment.sessionId as Id<"sessions">,
    membershipId: assignment.membershipId as Id<"memberships">,
  };
}

it("refuses to re-plan, repair or reset a frozen workspace", async () => {
  const { t, conferenceId } = await frozenWorkspace();

  await expect(t.mutation(api.plan.optimize, { conferenceId })).rejects.toThrow(refusal);
  await expect(t.mutation(api.plan.repair, { conferenceId })).rejects.toThrow(refusal);
  await expect(t.mutation(api.guest.resetWorkspace, { conferenceId })).rejects.toThrow(refusal);
});

it("refuses to claim or release a session on a frozen workspace", async () => {
  const { t, planId, revision, sessionId, membershipId } = await frozenWorkspace();
  const write = { planId, sessionId, membershipId, expectedRevision: revision };

  await expect(t.mutation(api.assignments.release, write)).rejects.toThrow(refusal);
  await expect(t.mutation(api.assignments.claim, write)).rejects.toThrow(refusal);
});

it("refuses to add a brief recipient or send the brief from a frozen workspace", async () => {
  const { t, conferenceId, membershipId } = await frozenWorkspace();
  const briefId = await t.run(async (ctx) =>
    ctx.db.insert("briefs", {
      conferenceId,
      body: "# Brief",
      model: "test",
      recipients: ["lead@example.test"],
      tripCostEstimate: null,
      sentAt: null,
    }),
  );

  await expect(
    t.mutation(api.notes.addBriefRecipient, {
      conferenceId,
      email: "stranger@example.test",
      addedBy: membershipId,
    }),
  ).rejects.toThrow(refusal);
  await expect(t.action(api.emailSend.sendBrief, { briefId })).rejects.toThrow(refusal);
  await expect(
    t.action(api.brief.generateBrief, { conferenceId, tripCostEstimate: null }),
  ).rejects.toThrow(refusal);
});

it("stores a reply to a frozen workspace without applying it", async () => {
  const { t, conferenceId, sessionId, membershipId } = await frozenWorkspace();
  const body = "I cannot make this one after all, a client call moved.";
  const eventId = await t.run(async (ctx) =>
    ctx.db.insert("emailEvents", {
      conferenceId,
      providerEventId: "evt-frozen",
      direction: "inbound",
      kind: "reply",
      membershipId,
      subject: "Re: your plan",
      body,
      intent: null,
      confidence: null,
      quote: null,
      fromAddress: "teammate@example.test",
      handled: false,
    }),
  );

  const outcome = await t.mutation(internal.emailReplies.applyParsedReply, {
    eventId,
    intent: "cant_attend",
    confidence: 0.97,
    quote: body,
    sessionId,
    body,
    applied: true,
  });

  const blocks = await t.run(async (ctx) =>
    ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .collect(),
  );

  expect(outcome.reason).toBe("frozen");
  expect(blocks).toHaveLength(0);
  await expect(
    t.mutation(api.emailReplies.resolveByHand, { eventId, sessionId, intent: "cant_attend" }),
  ).rejects.toThrow(refusal);
});

it("accepts writes again once the workspace is unfrozen", async () => {
  const { t, conferenceId } = await frozenWorkspace();
  await t.mutation(internal.frozen.setFrozen, { conferenceId, frozen: false });

  await expect(t.mutation(api.plan.optimize, { conferenceId })).resolves.toBeDefined();
});

it("sends refusals as ConvexError so production shows their message", () => {
  expect(new StaleRevisionError("The plan changed")).toBeInstanceOf(ConvexError);
});
