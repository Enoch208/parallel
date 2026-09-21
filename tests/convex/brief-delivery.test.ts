import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { freshHarness, seedCoverScenario } from "./fixtures";

interface SentRequest {
  readonly to: readonly string[];
  readonly subject: string;
}

let sent: SentRequest[] = [];

beforeEach(() => {
  sent = [];
  vi.stubEnv("AGENTMAIL_INBOX", "team@example.test");
  vi.stubEnv("AGENTMAIL_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: { body: string }) => {
      const request = JSON.parse(init.body) as SentRequest;
      sent.push(request);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            message_id: `msg-${String(sent.length)}`,
            thread_id: `thread-${String(sent.length)}`,
          }),
          { status: 200 },
        ),
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function seedBrief(recipients: readonly string[]) {
  const t = freshHarness();
  const briefId = await t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    return ctx.db.insert("briefs", {
      conferenceId: fixture.conferenceId,
      body: "## Reliable workflows\n- Their rollout took eighteen months. [note:1]",
      model: "test",
      recipients: [...recipients],
      tripCostEstimate: null,
      sentAt: null,
    });
  });
  return { t, briefId };
}

it("emails the brief to every recipient the lead added", async () => {
  const { t, briefId } = await seedBrief(["cfo@example.test", "vp@example.test"]);

  const result = await t.action(api.emailSend.sendBrief, { briefId });

  expect(result.sent).toBe(2);
  expect(sent.map((request) => request.to[0])).toEqual(["cfo@example.test", "vp@example.test"]);
  expect(sent[0]?.subject).toContain("what the team brought back");
});

it("never delivers the same brief to the same address twice", async () => {
  const { t, briefId } = await seedBrief(["cfo@example.test"]);

  await t.action(api.emailSend.sendBrief, { briefId });
  const again = await t.action(api.emailSend.sendBrief, { briefId });

  expect(sent).toHaveLength(1);
  expect(again.sent).toBe(0);
  expect(again.skipped).toBe(1);
});

it("marks the brief sent only once it has actually gone out", async () => {
  const { t, briefId } = await seedBrief(["cfo@example.test"]);

  expect((await t.run(async (ctx) => ctx.db.get(briefId)))?.sentAt).toBeNull();
  await t.action(api.emailSend.sendBrief, { briefId });

  const stamped = await t.run(async (ctx) => ctx.db.get(briefId));
  expect(typeof stamped?.sentAt).toBe("number");
});

it("refuses to send a brief nobody was chosen to receive", async () => {
  const { t, briefId } = await seedBrief([]);

  await expect(t.action(api.emailSend.sendBrief, { briefId })).rejects.toThrow(
    "Add at least one recipient",
  );
  expect(sent).toHaveLength(0);
});
