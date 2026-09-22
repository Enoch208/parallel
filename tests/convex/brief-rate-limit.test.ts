import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { freshHarness } from "./fixtures";

const modelCalls = { count: 0 };

const emptyBrief = {
  output: [
    { type: "message", content: [{ type: "output_text", text: JSON.stringify({ sections: [] }) }] },
  ],
};

beforeEach(() => {
  modelCalls.count = 0;
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      modelCalls.count += 1;
      return Promise.resolve(new Response(JSON.stringify(emptyBrief), { status: 200 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function workspaceWithTakeaway(t: ReturnType<typeof freshHarness>) {
  const conferenceId = await t.mutation(api.demo.seedDemoWorkspace, {});

  await t.run(async (ctx) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
      .first();
    const conference = await ctx.db.get(conferenceId);
    const member =
      conference === null
        ? null
        : await ctx.db
            .query("memberships")
            .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
            .first();

    if (session === null || member === null) {
      throw new Error("The demo workspace has no session or teammate to write a takeaway for");
    }

    await ctx.db.insert("notes", {
      conferenceId,
      sessionId: session._id,
      membershipId: member._id,
      body: "Their pilot ran on one ward for a month before any wider rollout.",
      source: "email",
    });
  });

  return conferenceId;
}

const write = (t: ReturnType<typeof freshHarness>, conferenceId: Id<"conferences">) =>
  t.action(api.brief.generateBrief, { conferenceId, tripCostEstimate: null });

it("lets one conference use up its brief allowance and then says when to retry", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithTakeaway(t);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await write(t, conferenceId);
  }

  await expect(write(t, conferenceId)).rejects.toMatchObject({ data: { kind: "rate_limited" } });
  await expect(write(t, conferenceId)).rejects.toThrow(/Try again in \d+ minutes?\./);
});

it("never calls the model for a refused attempt", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithTakeaway(t);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await write(t, conferenceId);
  }

  const before = modelCalls.count;
  await expect(write(t, conferenceId)).rejects.toMatchObject({ data: { kind: "rate_limited" } });

  expect(modelCalls.count).toBe(before);
});

it("keeps each conference's allowance separate", async () => {
  const t = freshHarness();
  const exhausted = await workspaceWithTakeaway(t);
  const other = await workspaceWithTakeaway(t);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await write(t, exhausted);
  }

  await expect(write(t, exhausted)).rejects.toMatchObject({ data: { kind: "rate_limited" } });
  await expect(write(t, other)).resolves.toMatchObject({ notesUsed: 1 });
});
