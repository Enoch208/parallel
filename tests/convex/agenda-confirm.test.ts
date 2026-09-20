import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { addSession, BASE, HOUR, freshHarness, seedCoverScenario } from "./fixtures";

function published(title: string, startsAt: number, room: string | null) {
  return {
    externalKey: `${title}@${String(startsAt)}`,
    title,
    room,
    startsAt,
    endsAt: startsAt + HOUR,
  };
}

describe("confirming a published agenda change", () => {
  it("writes a moved session back to the database", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    const outcome = await t.mutation(api.agendaWatch.confirmAgendaChanges, {
      conferenceId: fixture.conferenceId,
      contentHash: "second-fetch",
      next: [
        published("Durable Workflows", BASE + HOUR * 3, null),
        published("Vector Search", BASE + HOUR / 2, null),
      ],
    });

    expect(outcome.changed).toBeGreaterThan(0);

    const moved = await t.run((ctx) => ctx.db.get(fixture.droppedSessionId));
    expect(moved?.startsAt).toBe(BASE + HOUR * 3);
    expect(moved?.externalKey).toBe(`Durable Workflows@${String(BASE + HOUR * 3)}`);
  });

  it("writes a renamed session back without treating it as a disruption", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.mutation(api.agendaWatch.confirmAgendaChanges, {
      conferenceId: fixture.conferenceId,
      contentHash: "second-fetch",
      next: [
        published("Durable Workflows in Practice", BASE, null),
        published("Vector Search", BASE + HOUR / 2, null),
      ],
    });

    const renamed = await t.run((ctx) => ctx.db.get(fixture.droppedSessionId));
    expect(renamed?.title).toBe("Durable Workflows in Practice");
    expect(renamed?.externalKey).toBe(`Durable Workflows in Practice@${String(BASE)}`);
  });

  it("leaves an ambiguous session exactly as it was", async () => {
    const t = freshHarness();
    const fixture = await t.run((ctx) => seedCoverScenario(ctx));

    await t.run((ctx) => addSession(ctx, fixture, "Durable Workflows", BASE + HOUR * 5));

    await t.mutation(api.agendaWatch.confirmAgendaChanges, {
      conferenceId: fixture.conferenceId,
      contentHash: "second-fetch",
      next: [
        published("Durable Workflows", BASE + HOUR * 7, null),
        published("Vector Search", BASE + HOUR / 2, null),
      ],
    });

    const untouched = await t.run((ctx) => ctx.db.get(fixture.droppedSessionId));
    expect(untouched?.startsAt).toBe(BASE);
  });
});
