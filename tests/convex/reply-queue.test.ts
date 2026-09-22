import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { RunId } from "@convex-dev/action-retrier";
import { replyRetrier } from "../../convex/model/replyRetrier";
import { freshHarness, seedCoverScenario } from "./fixtures";

const body = "I can't make the Durable Workflows session any more, a client call moved.";

const modelAnswer = {
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: JSON.stringify({
            intent: "cant_attend",
            sessionHint: "Durable Workflows",
            timeHint: null,
            quote: "I can't make the Durable Workflows session any more",
            confidence: 0.95,
          }),
        },
      ],
    },
  ],
};

const provider = { status: 200, calls: 0 };

beforeEach(() => {
  provider.status = 200;
  provider.calls = 0;
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      provider.calls += 1;
      return Promise.resolve(
        provider.status === 200
          ? new Response(JSON.stringify(modelAnswer), { status: 200 })
          : new Response("{}", { status: provider.status }),
      );
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Harness = ReturnType<typeof freshHarness>;

async function routedTeam(t: Harness) {
  return t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    await ctx.db.insert("emailThreads", {
      conferenceId: fixture.conferenceId,
      membershipId: fixture.leaverId,
      providerThreadId: null,
      token: "ABCD",
    });
    return fixture;
  });
}

const delivery = (providerEventId: string) => ({
  providerEventId,
  kind: "message.received",
  fromAddress: "ada@example.com",
  subject: "Re: your plan [PL-ABCD]",
  body,
  providerThreadId: null,
});

async function eventsFor(t: Harness, providerEventId: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("emailEvents")
      .withIndex("by_provider_event", (q) => q.eq("providerEventId", providerEventId))
      .collect(),
  );
}

async function blockCount(t: Harness, conferenceId: Id<"conferences">): Promise<number> {
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("availabilityBlocks")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .collect(),
  );
  return rows.length;
}

it("saves a routed reply and queues its parse in the same write", async () => {
  const t = freshHarness();
  await routedTeam(t);

  const result = await t.mutation(internal.emailIngest.recordInbound, delivery("evt-1"));
  const [event] = await eventsFor(t, "evt-1");
  const runId = event?.parseRunId;

  expect(result).toMatchObject({ stored: true, queued: true });
  expect(event?.parseState).toBe("queued");
  expect(runId).toBeDefined();
  expect(
    await t.run(async (ctx) => replyRetrier.status(ctx, runId ?? ("" as RunId))),
  ).toMatchObject({ type: "inProgress" });
});

it("repairs a stored reply whose parse was never queued when the webhook is redelivered", async () => {
  const t = freshHarness();
  const fixture = await routedTeam(t);
  await t.run(async (ctx) =>
    ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: "evt-2",
      direction: "inbound",
      kind: "message.received",
      membershipId: fixture.leaverId,
      subject: "Re: your plan [PL-ABCD]",
      body,
      intent: null,
      confidence: null,
      quote: null,
      fromAddress: "ada@example.com",
      handled: false,
    }),
  );

  const redelivered = await t.mutation(internal.emailIngest.recordInbound, delivery("evt-2"));
  const events = await eventsFor(t, "evt-2");

  expect(redelivered).toMatchObject({ stored: false, queued: true });
  expect(events).toHaveLength(1);
  expect(events[0]?.parseState).toBe("queued");
});

it("applies a reply once however many times the webhook is redelivered", async () => {
  const t = freshHarness();
  const fixture = await routedTeam(t);

  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-3"));
  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-3"));
  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-3"));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-3"));
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [event] = await eventsFor(t, "evt-3");

  expect(provider.calls).toBe(1);
  expect(event?.handled).toBe(true);
  expect(event?.parseState).toBeUndefined();
  expect(await blockCount(t, fixture.conferenceId)).toBe(1);
});

it("keeps a reply on Evidence, marked failed, when every parsing attempt fails", async () => {
  const t = freshHarness();
  const fixture = await routedTeam(t);
  provider.status = 503;

  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-4"));
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [event] = await eventsFor(t, "evt-4");
  const trail = await t.query(api.evidence.constraintTrail, {
    conferenceId: fixture.conferenceId,
  });
  const listed = trail.unlinkedReplies.find((reply) => reply.eventId === event?._id);

  expect(provider.calls).toBe(4);
  expect(event?.handled).toBe(false);
  expect(event?.body).toBe(body);
  expect(event?.parseFailure).toBe(
    "Reply parsing failed after 4 attempts. Original email preserved.",
  );
  expect(listed?.parseState).toBe("failed");
  expect(await blockCount(t, fixture.conferenceId)).toBe(0);
});

it("retries a failed reply by hand once, and never applies it twice", async () => {
  const t = freshHarness();
  const fixture = await routedTeam(t);
  provider.status = 503;
  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-5"));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const [failed] = await eventsFor(t, "evt-5");
  const eventId = failed?._id;

  if (eventId === undefined) {
    throw new Error("The failed reply was not stored");
  }

  provider.status = 200;
  await t.mutation(api.replyParsing.retryReplyParsing, { eventId });
  await t.mutation(api.replyParsing.retryReplyParsing, { eventId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  await expect(t.mutation(api.replyParsing.retryReplyParsing, { eventId })).rejects.toThrow(
    /already been applied/,
  );
  expect(await blockCount(t, fixture.conferenceId)).toBe(1);
});

it("ignores a completion from a run the reply no longer points at", async () => {
  const t = freshHarness();
  await routedTeam(t);
  await t.mutation(internal.emailIngest.recordInbound, delivery("evt-6"));

  const outcome = await t.mutation(internal.replyParsing.parseFinished, {
    runId: "a-run-that-is-not-current" as RunId,
    result: { type: "failed", error: "late" },
  });
  const [event] = await eventsFor(t, "evt-6");

  expect(outcome.updated).toBe(false);
  expect(event?.parseState).toBe("queued");
});
