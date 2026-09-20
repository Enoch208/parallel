import { describe, expect, it } from "vitest";
import { hourFromTimeHint, matchSessionByTime } from "../../convex/model/sessionMatch";
import type { SessionSummary } from "../../convex/model/types";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const twoPmPacific = Date.UTC(2026, 8, 22, 21, 0, 0);

function sessionAt(id: string, title: string, offsetMs: number): SessionSummary {
  return {
    id,
    title,
    track: null,
    room: null,
    speakers: [],
    sourceUrl: "https://example.test/agenda",
    startsAt: twoPmPacific + offsetMs,
    endsAt: twoPmPacific + offsetMs + HOUR,
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
  };
}

const pacific = "America/Los_Angeles";

describe("ambiguous session matching", () => {
  it("refuses to guess when two sessions fall in the same hour", () => {
    const sessions = [sessionAt("s1", "Platform", 0), sessionAt("s2", "Data", 15 * MINUTE)];

    expect(matchSessionByTime(sessions, "2pm", pacific)).toBeNull();
  });

  it("matches the single session in that hour when the other is far enough away", () => {
    const sessions = [sessionAt("s1", "Platform", 0), sessionAt("s2", "Data", 45 * MINUTE)];

    expect(matchSessionByTime(sessions, "2pm", pacific)?.id).toBe("s1");
    expect(matchSessionByTime(sessions, "2:45pm", pacific)?.id).toBe("s2");
  });

  it("returns nothing for a hint with no clock time", () => {
    for (const hint of [
      "tomorrow",
      "the afternoon one",
      "after lunch",
      "noon",
      "the keynote",
      "",
    ]) {
      expect(hourFromTimeHint(hint)).toBeNull();
      expect(matchSessionByTime([sessionAt("s1", "Platform", 0)], hint, pacific)).toBeNull();
    }
  });

  it("does not read a 24 hour clock, which is the wording the plan email itself suggests", () => {
    const sessions = [sessionAt("s1", "Platform", 0)];

    expect(hourFromTimeHint("14:00")).toBeNull();
    expect(matchSessionByTime(sessions, "I cannot make the 14:00", pacific)).toBeNull();
    expect(matchSessionByTime(sessions, "2pm", pacific)?.id).toBe("s1");
  });

  it("reads the hint against the conference timezone, so the same instant matches in one zone and not another", () => {
    const sessions = [sessionAt("s1", "Platform", 0)];

    expect(matchSessionByTime(sessions, "2pm", pacific)?.id).toBe("s1");
    expect(matchSessionByTime(sessions, "2pm", "Africa/Lagos")).toBeNull();
    expect(matchSessionByTime(sessions, "10pm", "Africa/Lagos")?.id).toBe("s1");
    expect(matchSessionByTime(sessions, "5pm", "America/New_York")?.id).toBe("s1");
  });

  it("leaves a session on the back half of an hour unreachable from any whole hour hint", () => {
    const sessions = [sessionAt("s1", "Platform", -15 * MINUTE)];

    expect(matchSessionByTime(sessions, "2pm", pacific)).toBeNull();
    expect(matchSessionByTime(sessions, "1pm", pacific)).toBeNull();
    expect(matchSessionByTime(sessions, "1:30pm", pacific)?.id).toBe("s1");
  });

  it("normalizes noon and midnight rather than sliding them twelve hours", () => {
    expect(hourFromTimeHint("12pm")).toEqual({ hour: 12, minute: 0 });
    expect(hourFromTimeHint("12am")).toEqual({ hour: 0, minute: 0 });
    expect(hourFromTimeHint("12:30am")).toEqual({ hour: 0, minute: 30 });
  });

  it("refuses an impossible clock time rather than wrapping it", () => {
    for (const hint of ["13pm", "0am", "25pm", "10.30am"]) {
      expect(hourFromTimeHint(hint)).toBeNull();
    }
  });

  it("tolerates the punctuation and spacing a person actually types", () => {
    expect(hourFromTimeHint("2 PM")).toEqual({ hour: 14, minute: 0 });
    expect(hourFromTimeHint("2p.m.")).toEqual({ hour: 14, minute: 0 });
    expect(hourFromTimeHint("at 2p")).toEqual({ hour: 14, minute: 0 });
    expect(hourFromTimeHint("the 3 pm-ish slot")).toEqual({ hour: 15, minute: 0 });
  });

  it("does not read a bare number followed by an a or p word as a time", () => {
    expect(hourFromTimeHint("the 3 amazing talks")).toBeNull();
    expect(hourFromTimeHint("room 5 please")).toBeNull();
  });

  it("throws on a conference timezone the schema never validated", () => {
    expect(() => matchSessionByTime([sessionAt("s1", "Platform", 0)], "2pm", "Not/AZone")).toThrow(
      RangeError,
    );
  });
});
