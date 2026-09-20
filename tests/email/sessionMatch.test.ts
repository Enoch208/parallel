import { describe, expect, it } from "vitest";
import { hourFromTimeHint, matchSessionByTime } from "../../convex/model/sessionMatch";
import type { SessionSummary } from "../../convex/model/types";

function session(id: string, title: string, iso: string): SessionSummary {
  const startsAt = Date.parse(iso);

  return {
    id,
    title,
    track: null,
    room: null,
    speakers: [],
    startsAt,
    endsAt: startsAt + 40 * 60 * 1000,
    sourceUrl: "https://example.com/agenda",
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
  };
}

const zone = "America/Los_Angeles";
const sessions = [
  session("a", "Morning keynote", "2026-02-22T17:00:00Z"),
  session("b", "Payer fireside", "2026-02-22T21:00:00Z"),
  session("c", "Evening wrap", "2026-02-23T01:00:00Z"),
];

describe("hourFromTimeHint", () => {
  it("reads afternoon hints", () => {
    expect(hourFromTimeHint("2pm")).toEqual({ hour: 14, minute: 0 });
    expect(hourFromTimeHint("the 2:30pm one")).toEqual({ hour: 14, minute: 30 });
  });

  it("reads morning hints and noon and midnight", () => {
    expect(hourFromTimeHint("9am")).toEqual({ hour: 9, minute: 0 });
    expect(hourFromTimeHint("12pm")).toEqual({ hour: 12, minute: 0 });
    expect(hourFromTimeHint("12am")).toEqual({ hour: 0, minute: 0 });
  });

  it("returns null when there is no clock time", () => {
    expect(hourFromTimeHint("later today")).toBeNull();
    expect(hourFromTimeHint("")).toBeNull();
  });
});

describe("matchSessionByTime", () => {
  it("matches exactly one session in the conference timezone", () => {
    const match = matchSessionByTime(sessions, "1pm", zone);
    expect(match?.id).toBe("b");
  });

  it("returns null when nothing matches", () => {
    expect(matchSessionByTime(sessions, "4pm", zone)).toBeNull();
  });

  it("refuses to guess when two sessions share the hour", () => {
    const ambiguous = [...sessions, session("d", "Another at one", "2026-02-22T21:10:00Z")];
    expect(matchSessionByTime(ambiguous, "1pm", zone)).toBeNull();
  });
});
