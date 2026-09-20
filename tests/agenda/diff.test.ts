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
