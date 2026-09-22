import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { admitVisitor } from "../../convex/model/rateLimits";
import { freshHarness } from "./fixtures";

const visitor = "7d0f6c1e-2b1a-4c3d-9e8f-0a1b2c3d4e5f";
const otherVisitor = "0e9d8c7b-6a5f-4e3d-8c1b-a9f8e7d6c5b4";
const refusal = "This browser has done that several times.";
const providerCalls = { count: 0 };
const demoBudget = { timeout: 60_000 };

beforeEach(() => {
  providerCalls.count = 0;
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      providerCalls.count += 1;
      return Promise.resolve(new Response("{}", { status: 500 }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Harness = ReturnType<typeof freshHarness>;

const admitImport = (t: Harness, key: string) =>
  t.run(async (ctx) => {
    await admitVisitor(ctx, "agendaImport", key, refusal);
    return "admitted" as const;
  });

const importRequest = (visitorKey: string) => ({
  agendaUrl: "https://example.com/agenda",
  conferenceName: "Test Summit",
  teamName: "Test team",
  timezone: "UTC",
  dayMarker: null,
  visitorKey,
});

async function conferenceCount(t: Harness): Promise<number> {
  const rows = await t.run(async (ctx) => ctx.db.query("conferences").collect());
  return rows.length;
}

it("admits two imports from one browser, then says when to try again", async () => {
  const t = freshHarness();

  await admitImport(t, visitor);
  await admitImport(t, visitor);

  await expect(admitImport(t, visitor)).rejects.toMatchObject({ data: { kind: "rate_limited" } });
  await expect(admitImport(t, visitor)).rejects.toThrow(/Try again in \d+ minutes?\./);
});

it("keeps another browser's allowance separate", async () => {
  const t = freshHarness();
  await admitImport(t, visitor);
  await admitImport(t, visitor);

  await expect(admitImport(t, otherVisitor)).resolves.toBe("admitted");
});

it("refuses startImport from an exhausted browser before any conference or provider work", async () => {
  const t = freshHarness();
  await admitImport(t, visitor);
  await admitImport(t, visitor);

  await expect(
    t.mutation(api.importWorkflow.startImport, importRequest(visitor)),
  ).rejects.toMatchObject({ data: { kind: "rate_limited" } });

  expect(await conferenceCount(t)).toBe(0);
  expect(providerCalls.count).toBe(0);
});

it("refuses a malformed visitor key cleanly, before creating anything", async () => {
  const t = freshHarness();

  await expect(
    t.mutation(api.importWorkflow.startImport, importRequest("not-a-visitor-key")),
  ).rejects.toThrow(/visitor key/);
  await expect(t.action(api.judges.runDemo, { visitorKey: "x".repeat(200) })).rejects.toThrow(
    /visitor key/,
  );

  expect(await conferenceCount(t)).toBe(0);
});

it(
  "runs the demo five times for one browser, then refuses without creating a workspace",
  demoBudget,
  async () => {
    const t = freshHarness();

    for (let run = 0; run < 5; run += 1) {
      const result = await t.action(api.judges.runDemo, { visitorKey: visitor });
      expect(result.steps.length).toBeGreaterThan(0);
    }

    const before = await conferenceCount(t);

    await expect(t.action(api.judges.runDemo, { visitorKey: visitor })).rejects.toMatchObject({
      data: { kind: "rate_limited" },
    });
    expect(await conferenceCount(t)).toBe(before);

    const other = await t.action(api.judges.runDemo, { visitorKey: otherVisitor });
    expect(other.steps.length).toBeGreaterThan(0);
    expect(providerCalls.count).toBe(0);
  },
);
