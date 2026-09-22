import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { judgeTokenIn, mintJudgeToken } from "../../convex/model/judgeToken";
import { freshHarness, seedCoverScenario } from "./fixtures";

const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const budget = { timeout: 60_000 };
const model = { intent: "cant_attend", failures: [] as number[], calls: 0 };

type Harness = ReturnType<typeof freshHarness>;

function modelReading(body: string) {
  const clause = body.split(",")[0] ?? body;
  const title = /"([^"]+)"/.exec(body)?.[1] ?? null;
  return {
    intent: model.intent,
    sessionHint: model.intent === "question" ? null : title,
    timeHint: null,
    quote: clause,
    confidence: 0.95,
  };
}

beforeEach(() => {
  model.intent = "cant_attend";
  model.failures = [];
  model.calls = 0;
  vi.useFakeTimers();
  vi.stubEnv("AGENTMAIL_WEBHOOK_SECRET", secret);
  vi.stubEnv("AGENTMAIL_INBOX", "parallel@agentmail.test");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: { body: string }) => {
      model.calls += 1;
      const status = model.failures.shift() ?? 200;

      if (status !== 200) {
        return Promise.resolve(new Response("{}", { status }));
      }

      const request = JSON.parse(init.body) as { input: { content: string }[] };
      const text = JSON.stringify(modelReading(request.input[1]?.content ?? ""));
      const answer = { output: [{ type: "message", content: [{ type: "output_text", text }] }] };
      return Promise.resolve(new Response(JSON.stringify(answer), { status: 200 }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function sign(payload: string, messageId: string, sentAt: string): Promise<string> {
  const raw = atob(secret.slice("whsec_".length));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${messageId}.${sentAt}.${payload}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
}

async function deliver(
  t: Harness,
  mail: { subject: string; body: string; eventId: string; from?: string },
): Promise<void> {
  const payload = JSON.stringify({
    event_type: "message.received",
    event_id: mail.eventId,
    message: {
      message_id: `m-${mail.eventId}`,
      thread_id: `t-${mail.eventId}`,
      from: mail.from ?? "judge.person@example.org",
      subject: mail.subject,
      extracted_text: mail.body,
    },
  });
  const sentAt = String(Math.floor(Date.now() / 1000));
  const response = await t.fetch("/webhooks/agentmail", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": `svix-${mail.eventId}`,
      "svix-timestamp": sentAt,
      "svix-signature": await sign(payload, `svix-${mail.eventId}`, sentAt),
    },
    body: payload,
  });
  expect(response.status).toBe(200);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function judgeDemo(t: Harness) {
  const run = await t.action(api.judges.runDemo, { visitorKey: randomUUID() });

  if (run.judgeEmail === null) {
    throw new Error("The demo did not issue a judge email");
  }

  const token = judgeTokenIn(run.judgeEmail.subject);

  if (token === null) {
    throw new Error("The judge subject carries no token");
  }

  return { conferenceId: run.conferenceId, email: run.judgeEmail, token };
}

async function snapshot(t: Harness, conferenceId: Id<"conferences">) {
  return t.run(async (ctx) => ({
    revision: (await ctx.db.get(conferenceId))?.constraintRevision,
    blocks: (
      await ctx.db
        .query("availabilityBlocks")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect()
    ).length,
    judgeEvents: (
      await ctx.db
        .query("emailEvents")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect()
    ).filter((event) => event.judgeTokenId !== undefined),
    tokens: await ctx.db
      .query("judgeTokens")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .collect(),
  }));
}

async function unmatchedCount(t: Harness): Promise<number> {
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("emailEvents")
      .withIndex("by_conference", (q) => q.eq("conferenceId", null))
      .collect(),
  );
  return rows.length;
}

it(
  "a judge's email changes only their own demo workspace and makes its plan stale",
  budget,
  async () => {
    const t = freshHarness();
    const a = await judgeDemo(t);
    const b = await judgeDemo(t);
    const beforeA = await snapshot(t, a.conferenceId);
    const beforeB = await snapshot(t, b.conferenceId);

    expect(
      await t.query(api.judgeEmail.judgeEmailStatus, { conferenceId: a.conferenceId }),
    ).toMatchObject({ state: "waiting" });

    await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "a-1" });

    const afterA = await snapshot(t, a.conferenceId);
    const afterB = await snapshot(t, b.conferenceId);
    const planA = await t.query(api.board.latestPlan, { conferenceId: a.conferenceId });

    expect(afterA.revision).toBe((beforeA.revision ?? 0) + 1);
    expect(afterA.blocks).toBe(beforeA.blocks + 1);
    expect(planA?.isStale).toBe(true);
    expect(afterB).toEqual(beforeB);
    expect(
      await t.query(api.judgeEmail.judgeEmailStatus, { conferenceId: a.conferenceId }),
    ).toMatchObject({ state: "applied" });
  },
);

it("two judges' emails each change only their own workspace", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const b = await judgeDemo(t);

  await deliver(t, { subject: b.email.subject, body: b.email.body, eventId: "b-1" });
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "a-1" });

  const afterA = await snapshot(t, a.conferenceId);
  const afterB = await snapshot(t, b.conferenceId);

  expect(afterA.judgeEvents).toHaveLength(1);
  expect(afterB.judgeEvents).toHaveLength(1);
  expect(afterA.judgeEvents[0]?.judgeTokenId).toBe(afterA.tokens[0]?._id);
  expect(afterB.judgeEvents[0]?.judgeTokenId).toBe(afterB.tokens[0]?._id);
});

it("an invalid token changes nothing and never reaches the model", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const before = await snapshot(t, a.conferenceId);

  await deliver(t, {
    subject: `[JD-${mintJudgeToken()}] I can't make a session`,
    body: a.email.body,
    eventId: "forged",
  });

  expect(await snapshot(t, a.conferenceId)).toEqual(before);
  expect(await unmatchedCount(t)).toBe(1);
  expect(model.calls).toBe(0);
});

it("an expired token changes nothing and never reaches the model", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  await t.run(async (ctx) => {
    for (const token of await ctx.db
      .query("judgeTokens")
      .withIndex("by_conference", (q) => q.eq("conferenceId", a.conferenceId))
      .collect()) {
      await ctx.db.patch(token._id, { expiresAt: Date.now() - 1 });
    }
  });
  const before = await snapshot(t, a.conferenceId);

  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "late" });

  expect((await snapshot(t, a.conferenceId)).blocks).toBe(before.blocks);
  expect(await unmatchedCount(t)).toBe(1);
  expect(model.calls).toBe(0);
});

it(
  "a token cannot reach a workspace that is not demo data, or one that is frozen",
  budget,
  async () => {
    const t = freshHarness();
    const a = await judgeDemo(t);

    await t.run(async (ctx) => ctx.db.patch(a.conferenceId, { isDemoData: false }));
    await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "real" });
    await t.run(async (ctx) => ctx.db.patch(a.conferenceId, { isDemoData: true, frozen: true }));
    await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "frozen" });

    expect(await unmatchedCount(t)).toBe(2);
    expect(model.calls).toBe(0);
  },
);

it("ordinary [PL-XXXX] routing still works exactly as before", budget, async () => {
  const t = freshHarness();
  const fixture = await t.run(async (ctx) => {
    const seeded = await seedCoverScenario(ctx);
    await ctx.db.insert("emailThreads", {
      conferenceId: seeded.conferenceId,
      membershipId: seeded.leaverId,
      providerThreadId: null,
      token: "ABCD",
    });
    return seeded;
  });

  await deliver(t, {
    subject: "Re: your plan [PL-ABCD]",
    body: 'I can\'t make "Durable Workflows" any more, a client call moved.',
    eventId: "teammate",
    from: "ada@example.com",
  });

  const event = await t.run(async (ctx) =>
    ctx.db
      .query("emailEvents")
      .withIndex("by_provider_event", (q) => q.eq("providerEventId", "teammate"))
      .first(),
  );

  expect(event?.conferenceId).toBe(fixture.conferenceId);
  expect(event?.membershipId).toBe(fixture.leaverId);
  expect(event?.judgeTokenId).toBeUndefined();
  expect(event?.handled).toBe(true);
});

it(
  "the token never survives into stored or displayed data, and the sender is masked",
  budget,
  async () => {
    const t = freshHarness();
    const a = await judgeDemo(t);
    model.intent = "question";

    await deliver(t, {
      subject: a.email.subject,
      body: `${a.email.body}\n\n> ${a.email.subject}`,
      eventId: "leaky",
    });

    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("emailEvents")
        .withIndex("by_provider_event", (q) => q.eq("providerEventId", "leaky"))
        .first(),
    );
    const trail = await t.query(api.evidence.constraintTrail, { conferenceId: a.conferenceId });
    const shown = JSON.stringify(trail);

    expect(JSON.stringify(stored)).not.toContain(a.token);
    expect(shown).not.toContain(a.token);
    expect(shown).not.toContain("judge.person@example.org");
    expect(shown).toContain("j•••@example.org");
  },
);

it("a redelivered judge email is applied once", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const before = await snapshot(t, a.conferenceId);

  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "twice" });
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "twice" });

  const after = await snapshot(t, a.conferenceId);
  expect(after.blocks).toBe(before.blocks + 1);
  expect(after.judgeEvents).toHaveLength(1);
  expect(model.calls).toBe(1);
});

it("a read retried after a brief OpenAI failure is applied once", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const before = await snapshot(t, a.conferenceId);
  model.failures = [503];

  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "retried" });

  expect((await snapshot(t, a.conferenceId)).blocks).toBe(before.blocks + 1);
  expect(model.calls).toBe(2);
});

it(
  "an attempt over the token's limit is kept for the workspace but never read",
  budget,
  async () => {
    const t = freshHarness();
    const a = await judgeDemo(t);
    model.intent = "question";
    const start = Date.now();

    for (const attempt of [1, 2, 3, 4]) {
      vi.setSystemTime(start + attempt * 1000);
      await deliver(t, {
        subject: a.email.subject,
        body: a.email.body,
        eventId: `try-${String(attempt)}`,
      });
    }

    const after = await snapshot(t, a.conferenceId);
    const limited = after.judgeEvents.find((event) => event.providerEventId === "try-4");

    expect(model.calls).toBe(3);
    expect(limited?.parseState).toBe("failed");
    expect(limited?.parseFailure).toMatch(/Too many emails/);
  },
);

it("a successful change revokes the token, and it cannot be used again", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);

  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "first" });
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "second" });

  const after = await snapshot(t, a.conferenceId);
  expect(after.tokens[0]?.revokedAt).toBeDefined();
  expect(after.judgeEvents).toHaveLength(1);
  expect(await unmatchedCount(t)).toBe(1);
  expect(model.calls).toBe(1);
});

it("an email Parallel cannot place keeps the token alive for another try", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const before = await snapshot(t, a.conferenceId);
  model.intent = "question";

  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "unclear" });

  expect((await snapshot(t, a.conferenceId)).tokens[0]?.revokedAt).toBeUndefined();
  expect(
    await t.query(api.judgeEmail.judgeEmailStatus, { conferenceId: a.conferenceId }),
  ).toMatchObject({ state: "unplaced" });

  model.intent = "cant_attend";
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "clear" });

  expect((await snapshot(t, a.conferenceId)).blocks).toBe(before.blocks + 1);
});

it("a pin or a takeaway sent with a judge token changes nothing", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  const before = await snapshot(t, a.conferenceId);
  const counts = () =>
    t.run(async (ctx) => ({
      pins: (
        await ctx.db
          .query("memberPreferences")
          .withIndex("by_conference", (q) => q.eq("conferenceId", a.conferenceId))
          .collect()
      ).filter((row) => row.stance === "pinned").length,
      notes: (
        await ctx.db
          .query("notes")
          .withIndex("by_conference", (q) => q.eq("conferenceId", a.conferenceId))
          .collect()
      ).length,
    }));
  const beforeCounts = await counts();

  model.intent = "pin";
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "pin" });
  model.intent = "takeaways";
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "takeaway" });

  const after = await snapshot(t, a.conferenceId);
  expect(await counts()).toEqual(beforeCounts);
  expect(after.revision).toBe(before.revision);
  expect(after.judgeEvents.every((event) => !event.handled)).toBe(true);
});

it("removing the demo workspace removes the judge's email and token with it", budget, async () => {
  const t = freshHarness();
  const a = await judgeDemo(t);
  await deliver(t, { subject: a.email.subject, body: a.email.body, eventId: "gone" });

  await t.mutation(internal.guest.removeConference, { conferenceId: a.conferenceId });

  const after = await snapshot(t, a.conferenceId);
  expect(after.judgeEvents).toHaveLength(0);
  expect(after.tokens).toHaveLength(0);
});
