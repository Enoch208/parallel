import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { freshHarness, seedCoverScenario, HOUR, BASE } from "./fixtures";
import type { Id } from "../../convex/_generated/dataModel";

async function assignmentsFor(t: ReturnType<typeof freshHarness>, planId: Id<"plans">) {
  return t.run(async (ctx) =>
    ctx.db
      .query("assignments")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .collect(),
  );
}

describe("accepting a cover", () => {
  it("assigns the coverer and keeps the plan current", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 4,
    });

    expect(outcome.accepted).toBe(true);

    const rows = await assignmentsFor(t, fixture.planId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membershipId).toBe(fixture.covererId);
    expect(rows[0]?.sessionId).toBe(fixture.droppedSessionId);

    const { plan, conference, request } = await t.run(async (ctx) => ({
      plan: await ctx.db.get(fixture.planId),
      conference: await ctx.db.get(fixture.conferenceId),
      request: await ctx.db.get(fixture.requestId),
    }));

    expect(request?.status).toBe("accepted");
    expect(conference?.constraintRevision).toBe(5);
    expect(plan?.computedAtRevision).toBe(conference?.constraintRevision);
  });

  it("refuses when the caller's revision is behind the conference", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 3,
    });

    expect(outcome).toMatchObject({ accepted: false, reason: "stale_plan" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(0);
  });

  it("refuses when constraints moved on and the plan was never repaired", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.conferenceId, { constraintRevision: 7 });
    });

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 7,
    });

    expect(outcome).toMatchObject({ accepted: false, reason: "stale_plan" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(0);

    const request = await t.run((ctx) => ctx.db.get(fixture.requestId));
    expect(request?.status).toBe("asked");
  });

  it("refuses when the coverer is already booked over that hour", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.run(async (ctx) => {
      await ctx.db.insert("assignments", {
        planId: fixture.planId,
        conferenceId: fixture.conferenceId,
        sessionId: fixture.clashingSessionId,
        membershipId: fixture.covererId,
        pinned: false,
        reason: "Already going",
      });
    });

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 4,
    });

    expect(outcome).toMatchObject({ accepted: false, reason: "overlap" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(1);
  });

  it("refuses when the coverer became unavailable after being asked", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.run(async (ctx) => {
      await ctx.db.insert("availabilityBlocks", {
        conferenceId: fixture.conferenceId,
        membershipId: fixture.covererId,
        startsAt: BASE - HOUR / 4,
        endsAt: BASE + HOUR / 4,
        reason: "customer call",
        sourceQuote: null,
      });
    });

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 4,
    });

    expect(outcome).toMatchObject({ accepted: false, reason: "unavailable" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(0);
  });

  it("refuses a request that was already declined", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) =>
      seedCoverScenario(ctx, { coverRequestStatus: "declined" }),
    );

    const outcome = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 4,
    });

    expect(outcome).toMatchObject({ accepted: false, reason: "not_open" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(0);

    const request = await t.run((ctx) => ctx.db.get(fixture.requestId));
    expect(request?.status).toBe("declined");
  });

  it("is idempotent when the same acceptance arrives twice", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    const first = await t.mutation(api.cover.acceptCover, {
      requestId: fixture.requestId,
      expectedRevision: 4,
    });
    const second = await t.mutation(api.cover.acceptCover, { requestId: fixture.requestId });

    expect(first.accepted).toBe(true);
    expect(second).toMatchObject({ accepted: false, reason: "not_open" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(1);

    const activity = await t.run((ctx) =>
      ctx.db
        .query("activity")
        .withIndex("by_conference", (q) => q.eq("conferenceId", fixture.conferenceId))
        .collect(),
    );
    expect(activity.filter((row) => row.kind === "cover_accepted")).toHaveLength(1);
  });

  it("lets only one of two competing requests cover the same session", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    const secondRequestId = await t.run((ctx) =>
      ctx.db.insert("coverRequests", {
        conferenceId: fixture.conferenceId,
        planId: fixture.planId,
        sessionId: fixture.droppedSessionId,
        fromMember: fixture.leaverId,
        toMember: fixture.bystanderId,
        coverageGain: 1.5,
        status: "asked",
        reasons: ["Second best match"],
      }),
    );

    const first = await t.mutation(api.cover.acceptCover, { requestId: fixture.requestId });
    const second = await t.mutation(api.cover.acceptCover, { requestId: secondRequestId });

    expect(first.accepted).toBe(true);
    expect(second).toMatchObject({ accepted: false, reason: "already_covered" });

    const rows = await assignmentsFor(t, fixture.planId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membershipId).toBe(fixture.covererId);
  });

  it("refuses when the session left the agenda", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.run(async (ctx) => {
      await ctx.db.delete(fixture.droppedSessionId);
    });

    const outcome = await t.mutation(api.cover.acceptCover, { requestId: fixture.requestId });

    expect(outcome).toMatchObject({ accepted: false, reason: "session_gone" });
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(0);
  });

  it("leaves every refusal with no trace at all", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) =>
      seedCoverScenario(ctx, { coverRequestStatus: "declined" }),
    );

    await t.mutation(api.cover.acceptCover, { requestId: fixture.requestId });

    const [assignments, activity, conference] = await t.run(async (ctx) => [
      await ctx.db.query("assignments").collect(),
      await ctx.db.query("activity").collect(),
      await ctx.db.get(fixture.conferenceId),
    ]);

    expect(assignments).toHaveLength(0);
    expect(activity).toHaveLength(0);
    expect(conference?.constraintRevision).toBe(4);
  });
});

describe("declining a cover", () => {
  it("cannot reopen a request that was already accepted", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.mutation(api.cover.acceptCover, { requestId: fixture.requestId });
    const declined = await t.mutation(api.cover.declineCover, { requestId: fixture.requestId });

    expect(declined).toMatchObject({ declined: false, reason: "not_open" });

    const request = await t.run((ctx) => ctx.db.get(fixture.requestId));
    expect(request?.status).toBe("accepted");
    expect(await assignmentsFor(t, fixture.planId)).toHaveLength(1);
  });
});

describe("marking a request as asked", () => {
  it("does not drag a resolved request back to open", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) =>
      seedCoverScenario(ctx, { coverRequestStatus: "declined" }),
    );

    const outcome = await t.mutation(api.cover.markAsked, { requestId: fixture.requestId });

    expect(outcome.status).toBe("declined");
  });
});
