import { describe, expect, it } from "vitest";
import {
  parseReply,
  shouldApplyAutomatically,
  type ParsedReply,
} from "../../convex/model/replySchema";

const body = "Hi - can't make the 2pm, customer lunch ran over. Sorry!";

describe("parseReply", () => {
  it("keeps a verbatim quote and marks it verified", () => {
    const parsed = parseReply(
      {
        intent: "cant_attend",
        sessionHint: null,
        timeHint: "2pm",
        confidence: 0.98,
        quote: "can't make the 2pm, customer lunch ran over.",
      },
      body,
    );

    expect(parsed.intent).toBe("cant_attend");
    expect(parsed.quoteVerified).toBe(true);
    expect(shouldApplyAutomatically(parsed)).toBe(true);
  });

  it("rejects a paraphrased quote that is not in the body", () => {
    const parsed = parseReply(
      {
        intent: "cant_attend",
        sessionHint: null,
        timeHint: "2pm",
        confidence: 0.99,
        quote: "The teammate said they cannot attend the afternoon session.",
      },
      body,
    );

    expect(parsed.quoteVerified).toBe(false);
    expect(shouldApplyAutomatically(parsed)).toBe(false);
  });

  it("tolerates whitespace and case differences in the quote", () => {
    const parsed = parseReply(
      {
        intent: "cant_attend",
        sessionHint: null,
        timeHint: "2pm",
        confidence: 0.9,
        quote: "Can't  make   the 2pm",
      },
      body,
    );

    expect(parsed.quoteVerified).toBe(true);
  });

  it("never applies a low confidence reply even with a real quote", () => {
    const parsed = parseReply(
      { intent: "other", sessionHint: null, timeHint: null, confidence: 0.46, quote: "Sorry!" },
      body,
    );

    expect(parsed.quoteVerified).toBe(true);
    expect(shouldApplyAutomatically(parsed)).toBe(false);
  });

  it("clamps a confidence the model puts out of range", () => {
    const parsed: ParsedReply = parseReply(
      { intent: "yes", sessionHint: null, timeHint: null, confidence: 4.2, quote: null },
      "YES",
    );

    expect(parsed.confidence).toBe(1);
    expect(parsed.quoteVerified).toBe(false);
  });

  it("falls back to other for an unknown intent", () => {
    const parsed = parseReply(
      { intent: "explode", sessionHint: null, timeHint: null, confidence: 0.9, quote: null },
      body,
    );

    expect(parsed.intent).toBe("other");
  });
});

describe("startOfLocalDay", () => {
  it("anchors the budget window to the conference day, not UTC", async () => {
    const { startOfLocalDay } = await import("../../convex/model/zonedTime");
    const duringLaAfternoon = Date.UTC(2026, 1, 22, 23, 30);
    const laMidnight = startOfLocalDay(duringLaAfternoon, "America/Los_Angeles");
    const utcMidnight = Date.UTC(2026, 1, 22, 0, 0);

    expect(laMidnight).not.toBe(utcMidnight);
    expect(new Date(laMidnight).toISOString()).toBe("2026-02-22T08:00:00.000Z");
  });

  it("puts a late Lagos evening in the same local day", async () => {
    const { startOfLocalDay } = await import("../../convex/model/zonedTime");
    const lateEvening = Date.UTC(2026, 8, 20, 22, 0);
    const start = startOfLocalDay(lateEvening, "Africa/Lagos");

    expect(new Date(start).toISOString()).toBe("2026-09-19T23:00:00.000Z");
  });
});
