import { describe, expect, it } from "vitest";
import { diffAgenda, materialMoveMs, movedOrCancelled } from "../../convex/model/agendaDiff";
import type { DiffableSession } from "../../convex/model/agendaDiff";
import { sliceForDay } from "../../convex/model/agendaSlice";

const MINUTE = 60 * 1000;
const base = Date.UTC(2026, 8, 22, 16, 0, 0);

function entry(
  title: string,
  startMinutes: number,
  room: string | null = "Hall A",
): DiffableSession {
  return {
    externalKey: `${title}@${String(startMinutes)}`,
    title,
    room,
    startsAt: base + startMinutes * MINUTE,
    endsAt: base + (startMinutes + 60) * MINUTE,
  };
}

const published = [
  entry("Scaling Postgres", 0),
  entry("Vector search 101", 60),
  entry("Keynote: the road ahead", 120),
];

describe("agenda diff under extraction noise", () => {
  it("reports nothing for a re-extraction that only jitters times below the material move", () => {
    const jittered = published.map((session) => ({
      ...session,
      startsAt: session.startsAt + (materialMoveMs - 1),
      endsAt: session.endsAt + (materialMoveMs - 1),
    }));
    const diff = diffAgenda(published, jittered);

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it("reports a move once the jitter reaches the material threshold", () => {
    const moved = [
      entry("Scaling Postgres", materialMoveMs / MINUTE),
      entry("Vector search 101", 60),
      entry("Keynote: the road ahead", 120),
    ];
    const diff = diffAgenda(published, moved);

    expect(diff.changes.map((change) => change.kind)).toEqual(["moved"]);
    expect(diff.unchanged).toBe(2);
  });

  it("absorbs punctuation, casing and spacing in titles and rooms", () => {
    const rewritten = [
      { ...entry("scaling  postgres!", 0, "hall a"), externalKey: "different-key" },
      entry("Vector search, 101", 60, "Hall A "),
      entry("KEYNOTE — the road ahead", 120),
    ];
    const diff = diffAgenda(published, rewritten);

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it("reports a genuine cancellation and a genuine addition, and only those", () => {
    const next = [
      entry("Scaling Postgres", 0),
      entry("Vector search 101", 60),
      entry("Closing panel", 180),
    ];
    const diff = diffAgenda(published, next);

    expect(diff.changes.map((change) => [change.kind, change.title])).toEqual([
      ["cancelled", "Keynote: the road ahead"],
      ["added", "Closing panel"],
    ]);
    expect(diff.unchanged).toBe(2);
    expect(movedOrCancelled(diff).map((change) => change.kind)).toEqual(["cancelled"]);
  });

  it("does not report every session as cancelled and added when the whole agenda is re-rendered", () => {
    const rerendered = published.map((session) => ({
      ...session,
      externalKey: `rebuilt:${session.externalKey}`,
      title: `  ${session.title.toUpperCase()}.  `,
      room: `${session.room ?? ""}  `,
      startsAt: session.startsAt + MINUTE,
      endsAt: session.endsAt + MINUTE,
    }));
    const diff = diffAgenda(published, rerendered);

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it("reports a phantom cancellation when an organizer rewords a title by one word", () => {
    const reworded = [
      entry("Scaling Postgres at scale", 0),
      entry("Vector search 101", 60),
      entry("Keynote: the road ahead", 120),
    ];
    const diff = diffAgenda(published, reworded);

    expect(diff.changes.map((change) => change.kind)).toEqual(["cancelled", "added"]);
    expect(movedOrCancelled(diff)).toHaveLength(1);
  });

  it("loses a session when two on the same day share a title, and pairs the survivors wrongly", () => {
    const withTwoBreaks = [entry("Lunch", 180, null), entry("Lunch", 720, "Hall B")];
    const onlyTheFirst = [entry("Lunch", 180, null)];
    const diff = diffAgenda(withTwoBreaks, onlyTheFirst);

    expect(diff.changes.map((change) => change.kind)).toEqual(["moved"]);
    expect(diff.changes.map((change) => change.kind)).not.toContain("cancelled");
    expect(diff.changes.at(0)?.previousStartsAt).toBe(base + 720 * MINUTE);
    expect(diff.changes.at(0)?.nextStartsAt).toBe(base + 180 * MINUTE);
    expect(diff.unchanged).toBe(0);
  });

  it("reports an empty agenda as every session cancelled, never as no change", () => {
    const diff = diffAgenda(published, []);

    expect(diff.changes.map((change) => change.kind)).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
    expect(diff.unchanged).toBe(0);
  });

  it("is symmetric under repetition, so a re-run of the same scrape adds nothing", () => {
    expect(diffAgenda(published, published)).toEqual(diffAgenda(published, published));
    expect(diffAgenda(published, published).changes).toEqual([]);
  });
});

describe("day slicing under a hostile page", () => {
  const markdown = [
    "# Agenda",
    "## Monday, September 21",
    "- 09:00 Registration",
    "## Tuesday, September 22",
    "- 09:00 Keynote",
    "- 14:00 Platform deep dive",
    "## Wednesday, September 23",
    "- 09:00 Closing",
  ].join("\n");

  it("keeps only the requested day and stops at the next one", () => {
    const slice = sliceForDay(markdown, "Tuesday, September 22");

    expect(slice).toContain("Platform deep dive");
    expect(slice).not.toContain("Registration");
    expect(slice).not.toContain("Closing");
  });

  it("returns the same slice on every call, so a re-extraction cannot drift", () => {
    const first = sliceForDay(markdown, "Tuesday, September 22");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(sliceForDay(markdown, "Tuesday, September 22")).toBe(first);
    }
  });

  it("falls back to the head of the document when the marker is absent instead of returning nothing", () => {
    const slice = sliceForDay(markdown, "Friday, September 25");

    expect(slice.startsWith("# Agenda")).toBe(true);
    expect(slice.length).toBeGreaterThan(0);
  });

  it("caps a huge page so one enormous agenda cannot blow the extraction budget", () => {
    const huge = `## Tuesday, September 22\n${"- 09:00 Filler session\n".repeat(5000)}`;

    expect(sliceForDay(huge, "Tuesday, September 22").length).toBe(16000);
    expect(sliceForDay(huge, null).length).toBe(16000);
  });
});
