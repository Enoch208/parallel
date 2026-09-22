import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { freshHarness, seedCoverScenario } from "./fixtures";

const body = "I can't make the Durable Workflows session any more, a client call moved.";

const reading = {
  intent: "cant_attend",
  sessionHint: "Durable Workflows",
  timeHint: null,
  quote: "I can't make the Durable Workflows session any more",
  confidence: 0.95,
};

const modelAnswer = {
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(reading) }] }],
};

const replies: number[] = [];
const modelCalls = { count: 0 };

beforeEach(() => {
  replies.length = 0;
  modelCalls.count = 0;
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      modelCalls.count += 1;
      const status = replies.shift() ?? 200;
      return Promise.resolve(
        status === 200
          ? new Response(JSON.stringify(modelAnswer), { status })
          : new Response("{}", { status }),
      );
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function inboundReply(text: string) {
  const t = freshHarness();
  const seeded = await t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    const eventId = await ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: `evt-${String(text.length)}`,
      direction: "inbound",
      kind: "message.received",
      membershipId: fixture.leaverId,
      subject: "Re: your plan",
      body: text,
      intent: null,
      confidence: null,
      quote: null,
      fromAddress: "ada@example.com",
      handled: false,
    });
    return { fixture, eventId };
  });
  return { t, ...seeded };
}

async function blocksFor(
  t: ReturnType<typeof freshHarness>,
  conferenceId: Id<"conferences">,
): Promise<number> {
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .collect(),
  );
  return rows.length;
}

it("retries a reply after OpenAI is briefly unavailable, and applies it once", async () => {
  const { t, fixture, eventId } = await inboundReply(body);
  replies.push(503);

  await t.mutation(internal.emailReplies.queueReplyParsing, { eventId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const event = await t.run(async (ctx) => ctx.db.get(eventId));

  expect(modelCalls.count).toBe(2);
  expect(event?.handled).toBe(true);
  expect(await blocksFor(t, fixture.conferenceId)).toBe(1);
});

it("does not retry a reply OpenAI refused, and leaves it for a person", async () => {
  const { t, fixture, eventId } = await inboundReply(body);
  replies.push(400);

  await t.mutation(internal.emailReplies.queueReplyParsing, { eventId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const { event, notices } = await t.run(async (ctx) => ({
    event: await ctx.db.get(eventId),
    notices: (
      await ctx.db
        .query("activity")
        .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
        .collect()
    ).filter((row) => row.kind === "reply_unreadable"),
  }));

  expect(modelCalls.count).toBe(1);
  expect(event?.handled).toBe(false);
  expect(notices).toHaveLength(1);
  expect(await blocksFor(t, fixture.conferenceId)).toBe(0);
});

it("treats a reply that was already handled as done, without asking the model again", async () => {
  const { t, fixture, eventId } = await inboundReply(body);
  await t.run(async (ctx) => ctx.db.patch(eventId, { handled: true }));

  const outcome = await t.action(internal.emailReplies.parseAndApply, { eventId });

  expect(outcome.reason).toBe("already_handled");
  expect(modelCalls.count).toBe(0);
  expect(await blocksFor(t, fixture.conferenceId)).toBe(0);
});

it.each([
  ["cant_attend", body, "availabilityBlocks"],
  [
    "takeaways",
    "Takeaway from Durable Workflows: every step they showed was idempotent before it was retried.",
    "notes",
  ],
  [
    "pin",
    "Please keep me in the Durable Workflows session, I have to be there.",
    "memberPreferences",
  ],
] as const)(
  "applies a %s reply once even if it is delivered twice",
  async (intent, text, table) => {
    const { t, fixture, eventId } = await inboundReply(text);
    const write = {
      eventId,
      intent,
      confidence: 0.95,
      quote: text,
      sessionId: fixture.droppedSessionId,
      body: text,
      applied: true,
    };

    const first = await t.mutation(internal.emailReplies.applyParsedReply, write);
    const second = await t.mutation(internal.emailReplies.applyParsedReply, write);

    const { rows, conference } = await t.run(async (ctx) => ({
      rows: await ctx.db
        .query(table)
        .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
        .collect(),
      conference: await ctx.db.get(fixture.conferenceId),
    }));

    expect(first.applied).toBe(true);
    expect(second.reason).toBe("already_handled");
    expect(rows).toHaveLength(1);
    expect(conference?.constraintRevision).toBe(intent === "takeaways" ? 4 : 5);
  },
);
