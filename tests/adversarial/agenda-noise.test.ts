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

  it("reads a one word reword in the same room and slot as a rename, not a cancellation", () => {
    const reworded = [
      entry("Scaling Postgres at scale", 0),
      entry("Vector search 101", 60),
      entry("Keynote: the road ahead", 120),
    ];
    const diff = diffAgenda(published, reworded);

    expect(diff.changes.map((change) => change.kind)).toEqual(["renamed"]);
    expect(diff.changes.at(0)?.title).toBe("Scaling Postgres at scale");
    expect(diff.changes.at(0)?.detail).toContain("Scaling Postgres");
    expect(movedOrCancelled(diff)).toEqual([]);
    expect(diff.unchanged).toBe(2);
  });

  it("does not replace an unrelated session in the same slot with a rename", () => {
    const replaced = [
      entry("Rust for embedded radios", 0),
      entry("Vector search 101", 60),
      entry("Keynote: the road ahead", 120),
    ];
    const diff = diffAgenda(published, replaced);

    expect(diff.changes.map((change) => change.kind)).toEqual(["cancelled", "added"]);
    expect(movedOrCancelled(diff).map((change) => change.title)).toEqual(["Scaling Postgres"]);
  });

  it("keeps both sessions when two on the same day share a title and only one survives", () => {
    const withTwoBreaks = [entry("Lunch", 180, null), entry("Lunch", 720, "Hall B")];
    const onlyTheFirst = [entry("Lunch", 180, null)];
    const diff = diffAgenda(withTwoBreaks, onlyTheFirst);

    expect(diff.changes.map((change) => change.kind)).toEqual(["cancelled"]);
    expect(diff.changes.map((change) => change.kind)).not.toContain("moved");
    expect(diff.changes.at(0)?.previousStartsAt).toBe(base + 720 * MINUTE);
    expect(diff.changes.at(0)?.nextStartsAt).toBeNull();
    expect(diff.unchanged).toBe(1);
  });

  it("refuses to guess which of two same titled sessions the survivor is", () => {
    const twoLunches = [entry("Lunch", 180, "Hall A"), entry("Lunch", 720, "Hall B")];
    const oneElsewhere = [entry("Lunch", 400, "Hall C")];
    const diff = diffAgenda(twoLunches, oneElsewhere);

    expect(diff.changes.map((change) => change.kind)).toEqual([
      "ambiguous",
      "ambiguous",
      "ambiguous",
    ]);
    expect(diff.changes.map((change) => change.kind)).not.toContain("moved");
    expect(diff.changes.at(0)?.detail).toContain("could be this one");
    expect(diff.unchanged).toBe(0);
    expect(movedOrCancelled(diff)).toHaveLength(3);
    expect(diffAgenda([...twoLunches].reverse(), oneElsewhere)).toEqual(diff);
  });

  it("separates several generic titles in one pass without crossing any of them", () => {
    const before = [
      entry("Keynote", 0, "Main hall"),
      entry("Coffee Break", 90, "Foyer"),
      entry("Lunch", 240, "Hall A"),
      entry("Lunch", 300, "Hall A"),
      entry("Coffee Break", 420, "Foyer"),
    ];
    const after = [
      entry("Coffee Break", 420, "Foyer"),
      entry("Lunch", 300, "Hall A"),
      entry("Keynote", 0, "Main hall"),
      entry("Lunch", 240, "Hall A"),
      entry("Coffee Break", 90, "Foyer"),
    ];
    const diff = diffAgenda(before, after);

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(5);
  });

  it("moves only the coffee break that actually moved when two share the title", () => {
    const before = [
      entry("Coffee Break", 90, "Foyer"),
      entry("Coffee Break", 420, "Foyer"),
      entry("Lunch", 240, "Hall A"),
      entry("Lunch", 300, "Hall A"),
      entry("Keynote", 0, "Main hall"),
    ];
    const after = [
      entry("Coffee Break", 90, "Foyer"),
      entry("Coffee Break", 450, "Foyer"),
      entry("Lunch", 240, "Hall A"),
      entry("Lunch", 300, "Hall A"),
      entry("Keynote", 0, "Main hall"),
    ];
    const diff = diffAgenda(before, after);

    expect(diff.changes.map((change) => [change.kind, change.previousStartsAt])).toEqual([
      ["moved", base + 420 * MINUTE],
    ]);
    expect(diff.changes.at(0)?.nextStartsAt).toBe(base + 450 * MINUTE);
    expect(diff.unchanged).toBe(4);
  });

  it("produces the same answer when both pages are read back to front", () => {
    const before = [
      entry("Keynote", 0, "Main hall"),
      entry("Coffee Break", 90, "Foyer"),
      entry("Lunch", 240, "Hall A"),
      entry("Lunch", 300, "Hall B"),
      entry("Scaling Postgres", 360, "Hall A"),
      entry("Coffee Break", 420, "Foyer"),
    ];
    const after = [
      entry("Keynote", 0, "Main hall"),
      entry("Coffee Break", 90, "Foyer"),
      entry("Lunch", 240, "Hall A"),
      entry("Scaling Postgres at scale", 360, "Hall A"),
      entry("Coffee Break", 480, "Foyer"),
      entry("Closing panel", 540, "Main hall"),
    ];
    const forward = diffAgenda(before, after);
    const backward = diffAgenda([...before].reverse(), [...after].reverse());

    expect(backward).toEqual(forward);
    expect(forward.changes.map((change) => change.kind)).toEqual([
      "cancelled",
      "renamed",
      "moved",
      "added",
    ]);
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
