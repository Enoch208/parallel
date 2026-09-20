import { describe, expect, it } from "vitest";
import { diffAgenda, movedOrCancelled, type DiffableSession } from "../../convex/model/agendaDiff";

function session(key: string, hour: number, room: string | null = "408A"): DiffableSession {
  const startsAt = Date.UTC(2026, 1, 22, hour, 0);
  return { externalKey: key, title: `Session ${key}`, room, startsAt, endsAt: startsAt + 3600000 };
}

const published = [session("a", 10), session("b", 11), session("c", 13)];

describe("diffAgenda", () => {
  it("reports nothing when the agenda is identical", () => {
    const diff = diffAgenda(published, published);
    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it("detects a session that moved to a new time", () => {
    const diff = diffAgenda(published, [session("a", 10), session("b", 15), session("c", 13)]);
    const moved = diff.changes.find((change) => change.externalKey === "b");

    expect(moved?.kind).toBe("moved");
    expect(moved?.previousStartsAt).toBe(Date.UTC(2026, 1, 22, 11, 0));
    expect(moved?.nextStartsAt).toBe(Date.UTC(2026, 1, 22, 15, 0));
    expect(diff.unchanged).toBe(2);
  });

  it("detects a cancelled session", () => {
    const diff = diffAgenda(published, [session("a", 10), session("c", 13)]);
    expect(diff.changes.find((change) => change.externalKey === "b")?.kind).toBe("cancelled");
  });

  it("detects a newly added session", () => {
    const diff = diffAgenda(published, [...published, session("d", 16)]);
    expect(diff.changes.find((change) => change.externalKey === "d")?.kind).toBe("added");
  });

  it("reports a room change separately from a time change", () => {
    const diff = diffAgenda(published, [
      session("a", 10, "Hall B"),
      session("b", 11),
      session("c", 13),
    ]);
    const changed = diff.changes.find((change) => change.externalKey === "a");

    expect(changed?.kind).toBe("room_changed");
    expect(changed?.detail).toContain("Hall B");
  });

  it("treats only moves and cancellations as disrupting a plan", () => {
    const diff = diffAgenda(published, [
      session("a", 10, "Hall B"),
      session("b", 15),
      session("d", 16),
    ]);

    const disrupting = movedOrCancelled(diff)
      .map((change) => change.externalKey)
      .sort();
    expect(disrupting).toEqual(["b", "c"]);
  });
});

function at(title: string, hour: number, minute: number, room: string | null): DiffableSession {
  const startsAt = Date.UTC(2026, 1, 22, hour, minute);
  return {
    externalKey: `${title}@2026-02-22T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    title,
    room,
    startsAt,
    endsAt: startsAt + 3600000,
  };
}

describe("identity on an agenda that repeats titles", () => {
  const twoLunches = [at("Lunch", 12, 0, "Hall A"), at("Lunch", 19, 0, "Hall A")];

  it("keeps two sessions that share a title but sit at different times apart", () => {
    const diff = diffAgenda(twoLunches, [
      at("Lunch", 19, 0, "Hall A"),
      at("Lunch", 12, 0, "Hall A"),
    ]);

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(2);
  });

  it("moves only the repeat that moved, and leaves the other untouched", () => {
    const diff = diffAgenda(twoLunches, [
      at("Lunch", 12, 0, "Hall A"),
      at("Lunch", 20, 0, "Hall A"),
    ]);

    expect(diff.changes.map((change) => change.kind)).toEqual(["moved"]);
    expect(diff.changes.at(0)?.previousStartsAt).toBe(Date.UTC(2026, 1, 22, 19, 0));
    expect(diff.changes.at(0)?.nextStartsAt).toBe(Date.UTC(2026, 1, 22, 20, 0));
    expect(diff.unchanged).toBe(1);
  });

  it("keeps two sessions that share a title and a time but sit in different rooms apart", () => {
    const twoRooms = [at("Workshop", 11, 0, "Room 151"), at("Workshop", 11, 0, "Room 152")];
    const diff = diffAgenda(twoRooms, [
      at("Workshop", 11, 0, "Room 151"),
      at("Workshop", 14, 0, "Room 152"),
    ]);

    const moved = diff.changes.filter((change) => change.kind === "moved");

    expect(diff.changes).toHaveLength(1);
    expect(moved.at(0)?.nextStartsAt).toBe(Date.UTC(2026, 1, 22, 14, 0));
    expect(diff.unchanged).toBe(1);
  });

  it("reports a rename in place instead of a cancellation and an addition", () => {
    const before = [at("Scaling Postgres", 10, 0, "408A")];
    const diff = diffAgenda(before, [at("Scaling Postgres at scale", 10, 0, "408A")]);

    expect(diff.changes.map((change) => change.kind)).toEqual(["renamed"]);
    expect(diff.changes.at(0)?.externalKey).toBe(before[0]?.externalKey);
    expect(diff.changes.at(0)?.nextExternalKey).not.toBe(before[0]?.externalKey);
    expect(movedOrCancelled(diff)).toEqual([]);
  });

  it("reports a cancellation when a repeated title genuinely loses one of its sittings", () => {
    const diff = diffAgenda(twoLunches, [at("Lunch", 12, 0, "Hall A")]);

    expect(diff.changes.map((change) => [change.kind, change.previousStartsAt])).toEqual([
      ["cancelled", Date.UTC(2026, 1, 22, 19, 0)],
    ]);
    expect(diff.unchanged).toBe(1);
  });

  it("reports nothing when only the order of the published page changed", () => {
    const page = [
      at("Keynote", 9, 0, "Main hall"),
      at("Coffee Break", 10, 30, "Foyer"),
      at("Lunch", 12, 0, "Hall A"),
      at("Coffee Break", 15, 0, "Foyer"),
      at("Lunch", 19, 0, "Hall A"),
    ];
    const diff = diffAgenda(page, [...page].reverse());

    expect(diff.changes).toEqual([]);
    expect(diff.unchanged).toBe(5);
  });

  it("carries the previous key on a move, so a plan can find the session it holds", () => {
    const before = [at("Keynote", 9, 0, "Main hall")];
    const diff = diffAgenda(before, [at("Keynote", 11, 0, "Main hall")]);

    expect(movedOrCancelled(diff).map((change) => change.externalKey)).toEqual([
      before[0]?.externalKey,
    ]);
  });

  it("names the new room when a session both moved and changed room", () => {
    const diff = diffAgenda([at("Keynote", 9, 0, "Main hall")], [at("Keynote", 11, 0, "Hall B")]);

    expect(diff.changes.at(0)?.kind).toBe("moved");
    expect(diff.changes.at(0)?.detail).toContain("Hall B");
  });
});

const importedAgenda: readonly DiffableSession[] = (
  [
    ["The Evolution of Nursing in a Tech-Enabled Future", "408A", "10:00", 1771783200000],
    ["Reimagining Nursing Workflows: Giving Time Back to Care", "408A", "10:45", 1771785900000],
    [
      "Building Better RCM Automation Workshop: What to Fix First",
      "Room 152",
      "11:00",
      1771786800000,
    ],
    [
      "Nursing and Remote Care: Expanding Care Delivery Beyond the Bedside",
      "408A",
      "11:30",
      1771788600000,
    ],
    [
      "Community Health Centers 101: Purpose Meets Innovation and Partnership Workshop",
      "Room 151",
      "11:30",
      1771788600000,
    ],
    [
      "Modernizing the Payment Experience to Strengthen Provider Performance",
      "408B",
      "13:00",
      1771794000000,
    ],
    [
      "Digital Heath Startup Innovation: From Concept to Commercialization Health IT Innovation Workshop",
      "Room 152",
      "13:30",
      1771795800000,
    ],
    ["Navigating Healthcare Policy Twists in 2026", "408B", "13:45", 1771796700000],
    ["When Standards Serve the Patient", "408A", "14:00", 1771797600000],
  ] as const
).map(([title, room, local, startsAt]) => ({
  externalKey: `${title}@2026-02-22T${local}`,
  title,
  room,
  startsAt,
  endsAt: startsAt + 2400000,
}));

describe("the agenda that was actually imported", () => {
  it("reports no change when the same page is extracted twice in any order", () => {
    expect(diffAgenda(importedAgenda, importedAgenda).changes).toEqual([]);
    expect(diffAgenda(importedAgenda, [...importedAgenda].reverse()).unchanged).toBe(9);
  });

  it("absorbs re-extraction noise across every real session", () => {
    const noisy = importedAgenda.map((entry) => ({
      ...entry,
      externalKey: `rebuilt:${entry.externalKey}`,
      title: `  ${entry.title.toUpperCase()}.  `,
      room: `${entry.room ?? ""} `,
      startsAt: entry.startsAt + 120_000,
      endsAt: entry.endsAt + 120_000,
    }));

    expect(diffAgenda(importedAgenda, noisy).changes).toEqual([]);
  });

  it("reads a retitled real session as a rename and a shifted one as a move", () => {
    const edited = importedAgenda.map((entry) => {
      if (entry.title === "When Standards Serve the Patient") {
        return { ...entry, title: "When Standards Serve the Patient Better" };
      }

      if (entry.title === "Navigating Healthcare Policy Twists in 2026") {
        return { ...entry, startsAt: entry.startsAt + 2_700_000, endsAt: entry.endsAt + 2_700_000 };
      }

      return entry;
    });
    const diff = diffAgenda(importedAgenda, edited);

    expect(diff.changes.map((change) => change.kind)).toEqual(["moved", "renamed"]);
    expect(movedOrCancelled(diff).map((change) => change.title)).toEqual([
      "Navigating Healthcare Policy Twists in 2026",
    ]);
    expect(diff.unchanged).toBe(7);
  });

  it("keeps the two sessions that start at the same minute in different rooms apart", () => {
    const withoutTheWorkshop = importedAgenda.filter(
      (entry) => entry.room !== "Room 151" || entry.startsAt !== 1771788600000,
    );
    const diff = diffAgenda(importedAgenda, withoutTheWorkshop);

    expect(diff.changes.map((change) => [change.kind, change.title])).toEqual([
      [
        "cancelled",
        "Community Health Centers 101: Purpose Meets Innovation and Partnership Workshop",
      ],
    ]);
    expect(diff.unchanged).toBe(8);
  });
});

describe("tolerance for extraction noise", () => {
  it("ignores a difference smaller than a material move", () => {
    const nudged: DiffableSession[] = published.map((entry) => ({
      ...entry,
      startsAt: entry.startsAt + 60_000,
      endsAt: entry.endsAt + 60_000,
    }));

    expect(diffAgenda(published, nudged).changes).toEqual([]);
  });

  it("still reports a move that would actually disrupt someone", () => {
    const moved: DiffableSession[] = published.map((entry) =>
      entry.externalKey === "b"
        ? { ...entry, startsAt: entry.startsAt + 3_600_000, endsAt: entry.endsAt + 3_600_000 }
        : entry,
    );

    expect(diffAgenda(published, moved).changes).toHaveLength(1);
  });

  it("does not treat punctuation or casing differences as a new session", () => {
    const reworded = published.map((entry) => ({
      ...entry,
      externalKey: `${entry.externalKey}-different`,
      title: `${entry.title.toUpperCase()}!`,
    }));

    expect(diffAgenda(published, reworded).changes).toEqual([]);
  });

  it("does not treat whitespace in a room as a change", () => {
    const spaced = published.map((entry) => ({ ...entry, room: "  408A " }));
    expect(diffAgenda(published, spaced).changes).toEqual([]);
  });
});
