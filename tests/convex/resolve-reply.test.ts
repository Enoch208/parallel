import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { freshHarness, seedCoverScenario } from "./fixtures";

async function seedPendingReply(quote: string) {
  const t = freshHarness();
  const seeded = await t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    const eventId = await ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: `pending-${quote.length.toString()}`,
      direction: "inbound",
      kind: "reply",
      membershipId: fixture.leaverId,
      subject: "Re: your plan",
      body: quote,
      intent: "cant_attend",
      confidence: 0.99,
      quote,
      fromAddress: "teammate@example.test",
      handled: false,
    });
    return { fixture, eventId };
  });
  return { t, ...seeded };
}

it("applies a pending reply to the session a person chooses and keeps the email", async () => {
  const quote = "I cannot make the 14:00 after all.";
  const { t, fixture, eventId } = await seedPendingReply(quote);

  await t.mutation(api.emailReplies.resolveByHand, {
    eventId,
    sessionId: fixture.droppedSessionId,
    intent: "cant_attend",
  });

  const { event, blocks } = await t.run(async (ctx) => ({
    event: await ctx.db.get(eventId),
    blocks: await ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
      .collect(),
  }));

  expect(event?.handled).toBe(true);
  expect(event?.resolvedByHand).toBe(true);
  expect(event?.body).toBe(quote);
  expect(blocks.some((block) => block.sourceQuote === quote)).toBe(true);
});

it("removes a resolved reply from the pending list without deleting it", async () => {
  const quote = "Pin the evals session for me please.";
  const { t, fixture, eventId } = await seedPendingReply(quote);

  const before = await t.query(api.evidence.constraintTrail, {
    conferenceId: fixture.conferenceId,
  });
  expect(before.unlinkedReplies.map((reply) => reply.eventId)).toContain(eventId);

  await t.mutation(api.emailReplies.resolveByHand, {
    eventId,
    sessionId: fixture.droppedSessionId,
    intent: "pin",
  });

  const after = await t.query(api.evidence.constraintTrail, {
    conferenceId: fixture.conferenceId,
  });
  expect(after.unlinkedReplies.map((reply) => reply.eventId)).not.toContain(eventId);
  expect(await t.run(async (ctx) => ctx.db.get(eventId))).not.toBeNull();
});

it("refuses to apply the same reply twice", async () => {
  const { t, fixture, eventId } = await seedPendingReply("Cannot make that one, sorry.");

  await t.mutation(api.emailReplies.resolveByHand, {
    eventId,
    sessionId: fixture.droppedSessionId,
    intent: "cant_attend",
  });

  await expect(
    t.mutation(api.emailReplies.resolveByHand, {
      eventId,
      sessionId: fixture.droppedSessionId,
      intent: "cant_attend",
    }),
  ).rejects.toThrow("already been applied");
});

it("refuses a session that is not on this conference", async () => {
  const { t, eventId } = await seedPendingReply("Cannot make that one, sorry.");
  const elsewhere = await t.run(async (ctx) => {
    const other = await seedCoverScenario(ctx);
    return other.droppedSessionId;
  });

  await expect(
    t.mutation(api.emailReplies.resolveByHand, {
      eventId,
      sessionId: elsewhere,
      intent: "cant_attend",
    }),
  ).rejects.toThrow("not on this conference agenda");
});
