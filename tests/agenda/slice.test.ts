import { describe, expect, it } from "vitest";
import { sliceForDay } from "../../convex/model/agendaSlice";

const agenda = [
  "Filters and navigation noise",
  "VIVE Sunday, February 22, 2026",
  "10:00 AM Session One",
  "14:00 PM Session Two",
  "VIVE Monday, February 23, 2026",
  "09:00 AM Monday Session",
].join("\n");

describe("sliceForDay", () => {
  it("starts at the requested day", () => {
    const slice = sliceForDay(agenda, "Sunday, February 22");
    expect(slice.startsWith("Sunday, February 22")).toBe(true);
  });

  it("stops at the next day instead of cutting mid agenda", () => {
    const slice = sliceForDay(agenda, "Sunday, February 22");
    expect(slice).toContain("Session Two");
    expect(slice).not.toContain("Monday Session");
  });

  it("is stable across calls, so a re-extraction sees the same text", () => {
    expect(sliceForDay(agenda, "Sunday, February 22")).toBe(
      sliceForDay(agenda, "Sunday, February 22"),
    );
  });

  it("falls back to the start when the marker is absent", () => {
    expect(sliceForDay(agenda, "Friday, March 3").startsWith("Filters")).toBe(true);
  });

  it("takes the whole document when no day marker is given", () => {
    expect(sliceForDay(agenda, null)).toBe(agenda);
  });
});

describe("twenty-four hour time hints", () => {
  it("reads the wording the plan email actually suggests", async () => {
    const { hourFromTimeHint } = await import("../../convex/model/sessionMatch");
    expect(hourFromTimeHint("I cannot make the 14:00")).toEqual({ hour: 14, minute: 0 });
    expect(hourFromTimeHint("cant do 09:30 sorry")).toEqual({ hour: 9, minute: 30 });
  });

  it("still reads am and pm", async () => {
    const { hourFromTimeHint } = await import("../../convex/model/sessionMatch");
    expect(hourFromTimeHint("can't make the 2pm")).toEqual({ hour: 14, minute: 0 });
  });

  it("refuses an impossible twenty-four hour clock", async () => {
    const { hourFromTimeHint } = await import("../../convex/model/sessionMatch");
    expect(hourFromTimeHint("meet at 26:00")).toBeNull();
    expect(hourFromTimeHint("room 15:99")).toBeNull();
  });

  it("does not read a plain number as a time", async () => {
    const { hourFromTimeHint } = await import("../../convex/model/sessionMatch");
    expect(hourFromTimeHint("the 3 amazing talks")).toBeNull();
  });
});
