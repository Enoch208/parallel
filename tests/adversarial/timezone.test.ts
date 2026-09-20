import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertConferenceTimezone, isSupportedTimezone } from "../../convex/model/timezone";
import { matchSessionByTime } from "../../convex/model/sessionMatch";
import { startOfLocalDay, zonedTimeToEpoch } from "../../convex/model/zonedTime";
import type { SessionSummary } from "../../convex/model/types";

const realZones = ["America/Los_Angeles", "Africa/Lagos", "UTC", "Europe/London", "Asia/Kolkata"];

const nullByte = "America/Los\u0000Angeles";
const veryLong = `America/${"Los_Angeles".repeat(400)}`;

const malformed = ["Not/AZone", "", "   ", "UTC+1", nullByte, veryLong];

const session: SessionSummary = {
  id: "s1",
  title: "Platform deep dive",
  track: null,
  room: null,
  speakers: [],
  sourceUrl: "https://example.test/agenda",
  startsAt: Date.UTC(2026, 8, 22, 21, 0, 0),
  endsAt: Date.UTC(2026, 8, 22, 22, 0, 0),
  titleConfidence: "high",
  timeConfidence: "high",
  roomConfidence: "high",
};

describe("timezone validation", () => {
  it("accepts every zone this runtime can actually format with", () => {
    for (const zone of realZones) {
      expect(isSupportedTimezone(zone)).toBe(true);
      expect(() => {
        assertConferenceTimezone(zone);
      }).not.toThrow();
      expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: zone })).not.toThrow();
    }
  });

  it("accepts the zones the canonical list leaves out, which is why the list is not the check", () => {
    const canonical = Intl.supportedValuesOf("timeZone");

    expect(canonical).not.toContain("UTC");
    expect(canonical).not.toContain("Asia/Kolkata");
    expect(isSupportedTimezone("UTC")).toBe(true);
    expect(isSupportedTimezone("Asia/Kolkata")).toBe(true);
  });

  it("refuses every malformed value instead of letting Intl throw later", () => {
    for (const value of malformed) {
      expect(isSupportedTimezone(value)).toBe(false);
      expect(() => {
        assertConferenceTimezone(value);
      }).toThrow(Error);
      expect(() => {
        assertConferenceTimezone(value);
      }).not.toThrow(RangeError);
    }
  });

  it("refuses a lowercase spelling the runtime would silently repair", () => {
    expect(isSupportedTimezone("america/los_angeles")).toBe(true);
    expect(() => {
      assertConferenceTimezone("america/los_angeles");
    }).toThrow(/is not spelled the way IANA spells it/);
    expect(() => {
      assertConferenceTimezone("america/los_angeles");
    }).toThrow(/America\/Los_Angeles/);
  });

  it("names the offending value in the error", () => {
    expect(() => {
      assertConferenceTimezone("Not/AZone");
    }).toThrow(/"Not\/AZone"/);
    expect(() => {
      assertConferenceTimezone("UTC+1");
    }).toThrow(/"UTC\+1"/);
    expect(() => {
      assertConferenceTimezone(nullByte);
    }).toThrow(/America.Los/);
    expect(() => {
      assertConferenceTimezone(veryLong);
    }).toThrow(/America\/Los_Angeles/);
  });

  it("keeps the error short even when the offending value is enormous", () => {
    let message = "";

    try {
      assertConferenceTimezone(veryLong);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message.length).toBeLessThan(220);
    expect(message).toContain("America/Los_Angeles");
  });

  it("tells a caller with no timezone at all what a valid one looks like", () => {
    for (const blank of ["", "   "]) {
      expect(() => {
        assertConferenceTimezone(blank);
      }).toThrow(/A conference timezone is required. Use an IANA name like America\/Los_Angeles\./);
    }
  });
});

describe("use sites degrade instead of throwing on a legacy bad zone", () => {
  it("matchSessionByTime returns no match rather than a RangeError", () => {
    for (const value of [...malformed, "Europe/Nowhere"]) {
      expect(matchSessionByTime([session], "2pm", value)).toBeNull();
    }

    expect(matchSessionByTime([session], "2pm", "America/Los_Angeles")?.id).toBe("s1");
  });

  it("matchSessionByTime still honours a lowercase legacy row the runtime accepts", () => {
    expect(matchSessionByTime([session], "2pm", "america/los_angeles")?.id).toBe("s1");
  });

  it("zonedTimeToEpoch returns null rather than a RangeError", () => {
    for (const value of malformed) {
      expect(zonedTimeToEpoch("2026-09-22T14:00", value)).toBeNull();
    }

    expect(zonedTimeToEpoch("2026-09-22T14:00", "America/Los_Angeles")).toBe(
      Date.UTC(2026, 8, 22, 21, 0, 0),
    );
  });

  it("startOfLocalDay falls back to UTC midnight rather than a RangeError", () => {
    const noon = Date.UTC(2026, 8, 22, 12, 0, 0);
    const utcMidnight = Date.UTC(2026, 8, 22, 0, 0, 0);

    for (const value of malformed) {
      expect(startOfLocalDay(noon, value)).toBe(utcMidnight);
    }

    expect(startOfLocalDay(noon, "America/Los_Angeles")).toBe(Date.UTC(2026, 8, 22, 7, 0, 0));
  });
});

function handlerSource(file: string, exportName: string): string {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf(`export const ${exportName} =`);

  expect(start).toBeGreaterThan(-1);

  return source.slice(start);
}

function positionOf(source: string, needle: string): number {
  const at = source.indexOf(needle);

  expect(at, needle).toBeGreaterThan(-1);

  return at;
}

describe("the boundary refuses a bad zone before anything expensive runs", () => {
  it("refuses the value the expensive path used to choke on", () => {
    expect(() => {
      assertConferenceTimezone("Not/AZone");
    }).toThrow(/"Not\/AZone"/);
    expect(isSupportedTimezone("Not/AZone")).toBe(false);
  });

  it("importAgenda gates the timezone before the key, the scrape and the model call", () => {
    const source = handlerSource("../../convex/importAgenda.ts", "importAgenda");
    const gate = positionOf(source, "assertConferenceTimezone(args.timezone)");

    for (const spend of [
      'requireKey("OPENAI_API_KEY")',
      "ctx.runMutation(",
      "scrapeAgendaThroughComponent(",
      "structuredOutput(",
    ]) {
      expect(gate, spend).toBeLessThan(positionOf(source, spend));
    }
  });

  it("startImport gates the timezone before it creates a conference or starts the workflow", () => {
    const source = handlerSource("../../convex/importWorkflow.ts", "startImport");
    const gate = positionOf(source, "assertConferenceTimezone(args.timezone)");

    for (const spend of [
      "ctx.runMutation(",
      "internal.importWrites.createConference",
      "importWorkflows.start(",
    ]) {
      expect(gate, spend).toBeLessThan(positionOf(source, spend));
    }
  });
});
