import { expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import { freshHarness, seedCoverScenario } from "./fixtures";

async function seedInboundReply(body: string) {
  const t = freshHarness();
  const seeded = await t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    const eventId = await ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: `evt-${body.length.toString()}`,
      direction: "inbound",
      kind: "reply",
      membershipId: fixture.leaverId,
      subject: "Re: your plan",
      body,
      intent: null,
      confidence: null,
      quote: null,
      fromAddress: "teammate@example.test",
      handled: false,
    });
    return { fixture, eventId };
  });
  return { t, ...seeded };
}

it("turns a takeaway reply into a note against the session it names", async () => {
  const body = "Their rollout took eighteen months and two failed pilots.";
  const { t, fixture, eventId } = await seedInboundReply(body);

  const outcome = await t.mutation(internal.emailReplies.applyParsedReply, {
    eventId,
    intent: "takeaways",
    confidence: 0.96,
    quote: body,
    sessionId: fixture.droppedSessionId,
    body,
    applied: true,
  });

  expect(outcome.applied).toBe(true);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("notes")
      .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
      .collect(),
  );

  expect(stored).toHaveLength(1);
  expect(stored[0]?.body).toBe(body);
  expect(stored[0]?.source).toBe("email");
  expect(stored[0]?.membershipId).toBe(fixture.leaverId);
  expect(stored[0]?.sessionId).toBe(fixture.droppedSessionId);
});

it("does not block anyone's calendar when the reply is a takeaway", async () => {
  const body = "Best session of the day, their eval harness is open source.";
  const { t, fixture, eventId } = await seedInboundReply(body);

  const before = await t.run(async (ctx) => await ctx.db.get(fixture.conferenceId));

  await t.mutation(internal.emailReplies.applyParsedReply, {
    eventId,
    intent: "takeaways",
    confidence: 0.96,
    quote: body,
    sessionId: fixture.droppedSessionId,
    body,
    applied: true,
  });

  const { blocks, conference } = await t.run(async (ctx) => ({
    blocks: await ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
      .collect(),
    conference: await ctx.db.get(fixture.conferenceId),
  }));

  expect(blocks).toHaveLength(0);
  expect(conference?.constraintRevision).toBe(before?.constraintRevision);
});

it("keeps a takeaway that names no session pending instead of filing it anywhere", async () => {
  const body = "Good day overall, plenty to write up later.";
  const { t, fixture, eventId } = await seedInboundReply(body);

  const outcome = await t.mutation(internal.emailReplies.applyParsedReply, {
    eventId,
    intent: "takeaways",
    confidence: 0.96,
    quote: body,
    sessionId: null,
    body,
    applied: false,
  });

  expect(outcome.applied).toBe(false);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("notes")
      .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
      .collect(),
  );

  expect(stored).toHaveLength(0);
});
