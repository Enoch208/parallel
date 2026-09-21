import { describe, expect, it } from "vitest";
import type { OptimizerInput } from "../../convex/engine";
import { withoutSessions } from "../../convex/model/loadOptimizerInput";

function session(id: string) {
  return {
    id,
    title: id,
    track: null,
    room: null,
    speakers: [],
    startsAt: 0,
    endsAt: 1,
    sourceUrl: "https://example.test/agenda",
    titleConfidence: "high" as const,
    timeConfidence: "high" as const,
    roomConfidence: "high" as const,
  };
}

const input: OptimizerInput = {
  sessions: [session("kept"), session("cancelled")],
  goals: [{ id: "g", label: "Goal", weight: 3 }],
  scores: [
    { sessionId: "kept", goalId: "g", relevance: 0.5, reason: "", model: "test" },
    { sessionId: "cancelled", goalId: "g", relevance: 0.9, reason: "", model: "test" },
  ],
  members: [{ id: "m", displayName: "Maya" }],
  preferences: [{ membershipId: "m", sessionId: "cancelled", stance: "pinned" }],
  blocks: [],
};

describe("planning around a cancelled session", () => {
  it("removes the session, every score on it, and any pin to it", () => {
    const planned = withoutSessions(input, new Set(["cancelled"]));

    expect(planned.sessions.map((row) => row.id)).toEqual(["kept"]);
    expect(planned.scores.map((row) => row.sessionId)).toEqual(["kept"]);
    expect(planned.preferences).toEqual([]);
  });

  it("leaves members, goals and blocks alone", () => {
    const planned = withoutSessions(input, new Set(["cancelled"]));

    expect(planned.members).toBe(input.members);
    expect(planned.goals).toBe(input.goals);
    expect(planned.blocks).toBe(input.blocks);
  });

  it("returns the input untouched when nothing was cancelled", () => {
    expect(withoutSessions(input, new Set())).toBe(input);
  });
});
