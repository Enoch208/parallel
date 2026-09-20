import { describe, expect, it } from "vitest";
import { maxAttendableIntervals } from "../../convex/engine/attendable";
import { computeCoverageSummary } from "../../convex/engine/coverage";
import { overlaps } from "../../convex/engine/intervals";
import { itemAt } from "../../convex/engine/lookup";
import type { CoverageInput } from "../../convex/engine/types";
import type { SessionSummary, TimeWindow } from "../../convex/model/types";
import { goal, member, score, session } from "./fixtures";
import { createRandom, intBetween, type Random } from "./random-instances";

function bruteForceMaxAttendable(intervals: readonly TimeWindow[], attendeeCount: number): number {
  const trackCount = Math.min(Math.max(0, attendeeCount), intervals.length);
  if (trackCount === 0) return 0;
  const tracks: TimeWindow[][] = Array.from({ length: trackCount }, () => []);
  let best = 0;
  const place = (index: number, taken: number): void => {
    if (taken + (intervals.length - index) <= best) return;
    if (index === intervals.length) {
      best = taken;
      return;
    }
    const interval = itemAt(intervals, index);
    for (let track = 0; track < trackCount; track += 1) {
      const held = itemAt(tracks, track);
      const wasEmpty = held.length === 0;
      if (!held.some((other) => overlaps(other, interval))) {
        held.push(interval);
        place(index + 1, taken + 1);
        held.pop();
      }
      if (wasEmpty) break;
    }
    place(index + 1, taken);
  };
  place(0, 0);
  return best;
}

function teammates(attendeeCount: number): CoverageInput["members"] {
  return Array.from({ length: attendeeCount }, (_unused, index) =>
    member(`m${String(index)}`, `Teammate ${String(index)}`),
  );
}

function coverageInput(sessions: readonly SessionSummary[], attendeeCount: number): CoverageInput {
  return {
    sessions,
    goals: [goal("g1", "Learn something", 1)],
    members: teammates(attendeeCount),
    scores: sessions.map((entry) => score(entry.id, "g1", 0.5)),
  };
}

function denominator(sessions: readonly SessionSummary[], attendeeCount: number): number {
  return computeCoverageSummary(coverageInput(sessions, attendeeCount), []).maxAttendableSessions;
}

function slot(id: string, startHour: number, durationHours: number): SessionSummary {
  return session(id, `Session ${id}`, startHour, durationHours, "T");
}

function randomSchedule(random: Random, count: number): SessionSummary[] {
  return Array.from({ length: count }, (_unused, index) =>
    slot(`r${String(index)}`, intBetween(random, 0, 9) / 2, intBetween(random, 1, 4) / 2),
  );
}

function shuffled(sessions: readonly SessionSummary[], random: Random): SessionSummary[] {
  const copy = [...sessions];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = intBetween(random, 0, index);
    const held = itemAt(copy, index);
    copy[index] = itemAt(copy, swap);
    copy[swap] = held;
  }
  return copy;
}

const staggered = [slot("a", 0, 3), slot("b", 0.5, 3)];
const mutuallyOverlapping = [slot("a", 0, 3), slot("b", 0.5, 3), slot("c", 1, 3)];

describe("maximum attendable sessions", () => {
  it("agrees with brute force on every generated schedule", () => {
    const disagreements: string[] = [];
    let generated = 0;
    for (let seed = 1; seed <= 600; seed += 1) {
      const random = createRandom(seed);
      const count = intBetween(random, 0, 6);
      const attendeeCount = intBetween(random, 0, 4);
      const sessions = randomSchedule(random, count);
      const expected = bruteForceMaxAttendable(sessions, attendeeCount);
      const actual = maxAttendableIntervals(sessions, attendeeCount);
      generated += 1;
      if (actual === expected) continue;
      disagreements.push(
        `seed ${String(seed)} k=${String(attendeeCount)} n=${String(count)}: got ${String(actual)}, brute force ${String(expected)}`,
      );
    }
    expect(disagreements).toEqual([]);
    expect(generated).toBe(600);
  });

  it("reports the brute-forced denominator through the coverage summary", () => {
    for (let seed = 1000; seed <= 1200; seed += 1) {
      const random = createRandom(seed);
      const count = intBetween(random, 1, 6);
      const attendeeCount = intBetween(random, 1, 4);
      const sessions = randomSchedule(random, count);
      expect(denominator(sessions, attendeeCount)).toBe(
        bruteForceMaxAttendable(sessions, attendeeCount),
      );
    }
  });

  it("counts staggered overlaps as one session for one teammate", () => {
    expect(denominator(staggered, 1)).toBe(1);
    expect(denominator(staggered, 2)).toBe(2);
  });

  it("caps three mutually overlapping sessions at the number of teammates", () => {
    expect(denominator(mutuallyOverlapping, 1)).toBe(1);
    expect(denominator(mutuallyOverlapping, 2)).toBe(2);
    expect(denominator(mutuallyOverlapping, 3)).toBe(3);
  });

  it("treats a nested session as a conflict with the session containing it", () => {
    const nested = [slot("outer", 0, 4), slot("inner", 1, 1)];
    expect(denominator(nested, 1)).toBe(1);
    expect(denominator(nested, 2)).toBe(2);
  });

  it("lets one teammate attend sessions that only touch at an endpoint", () => {
    const backToBack = [slot("a", 0, 1), slot("b", 1, 1), slot("c", 2, 1)];
    expect(denominator(backToBack, 1)).toBe(3);
  });

  it("separates different durations that share a start time", () => {
    const ragged = [
      slot("short", 0, 1),
      slot("medium", 0, 2),
      slot("long", 0, 3),
      slot("late", 3, 1),
    ];
    expect(denominator(ragged, 1)).toBe(2);
    expect(denominator(ragged, 2)).toBe(3);
    expect(denominator(ragged, 3)).toBe(4);
    expect(denominator(ragged, 4)).toBe(4);
  });

  it("never exceeds the number of sessions however many teammates there are", () => {
    const two = [slot("a", 0, 1), slot("b", 2, 1)];
    expect(denominator(two, 5)).toBe(2);
    expect(maxAttendableIntervals(two, 1000)).toBe(2);
  });

  it("returns zero for no sessions or no teammates", () => {
    expect(denominator([], 4)).toBe(0);
    expect(denominator(mutuallyOverlapping, 0)).toBe(0);
    expect(maxAttendableIntervals([], 0)).toBe(0);
  });

  it("does not depend on the order the sessions arrive in", () => {
    for (let seed = 2000; seed <= 2060; seed += 1) {
      const random = createRandom(seed);
      const sessions = randomSchedule(random, intBetween(random, 1, 6));
      const attendeeCount = intBetween(random, 1, 4);
      const baseline = maxAttendableIntervals(sessions, attendeeCount);
      for (let shuffle = 0; shuffle < 4; shuffle += 1) {
        const reordered = shuffled(sessions, createRandom(seed + shuffle * 7919));
        expect(maxAttendableIntervals(reordered, attendeeCount)).toBe(baseline);
      }
      expect(maxAttendableIntervals(sessions, attendeeCount)).toBe(baseline);
    }
  });
});
