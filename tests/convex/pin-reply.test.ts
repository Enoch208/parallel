import { expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import { freshHarness, seedCoverScenario } from "./fixtures";

async function seedPinReply(body: string) {
  const t = freshHarness();
  const seeded = await t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    const eventId = await ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: `pin-${body.length.toString()}`,
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

async function applyPin(t: ReturnType<typeof freshHarness>, eventId: string, sessionId: string) {
  const body = "Please keep me on this one, I am presenting alongside it.";
  return t.mutation(internal.emailReplies.applyParsedReply, {
    eventId: eventId as never,
    intent: "pin",
    confidence: 0.94,
    quote: body,
    sessionId: sessionId as never,
    body,
    applied: true,
  });
}

it("pins the session a teammate asks to keep", async () => {
  const { t, fixture, eventId } = await seedPinReply("Keep me on the evals session please.");

  const outcome = await applyPin(t, eventId, fixture.droppedSessionId);
  expect(outcome.applied).toBe(true);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("memberPreferences")
      .withIndex("by_member", (q) =>
        q.eq("conferenceId", fixture.conferenceId).eq("membershipId", fixture.leaverId),
      )
      .collect(),
  );

  const pinned = stored.filter((row) => row.sessionId === fixture.droppedSessionId);
  expect(pinned).toHaveLength(1);
  expect(pinned[0]?.stance).toBe("pinned");
});

it("marks the plan stale so the lead decides when to replan", async () => {
  const { t, fixture, eventId } = await seedPinReply("I must be at that workshop.");

  const before = await t.run(async (ctx) => await ctx.db.get(fixture.conferenceId));
  await applyPin(t, eventId, fixture.droppedSessionId);
  const after = await t.run(async (ctx) => await ctx.db.get(fixture.conferenceId));

  expect(after?.constraintRevision).toBe((before?.constraintRevision ?? 0) + 1);
});

it("upgrades an existing stance rather than storing a second row", async () => {
  const { t, fixture, eventId } = await seedPinReply("Keep that one for me.");

  await t.run(async (ctx) => {
    await ctx.db.insert("memberPreferences", {
      conferenceId: fixture.conferenceId,
      membershipId: fixture.leaverId,
      sessionId: fixture.droppedSessionId,
      stance: "interested",
    });
  });

  await applyPin(t, eventId, fixture.droppedSessionId);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("memberPreferences")
      .withIndex("by_member", (q) =>
        q.eq("conferenceId", fixture.conferenceId).eq("membershipId", fixture.leaverId),
      )
      .collect(),
  );

  const rows = stored.filter((row) => row.sessionId === fixture.droppedSessionId);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.stance).toBe("pinned");
});
