import { describe, expect, it } from "vitest";
import { rankCoverCandidates, type CoverInput } from "../../convex/model/coverRanking";
import type { SessionSummary } from "../../convex/model/types";

function session(id: string, title: string, hour: number): SessionSummary {
  const startsAt = Date.UTC(2026, 1, 22, hour, 0);

  return {
    id,
    title,
    track: null,
    room: null,
    speakers: [],
    startsAt,
    endsAt: startsAt + 60 * 60 * 1000,
    sourceUrl: "https://example.com/agenda",
    titleConfidence: "high",
    timeConfidence: "high",
    roomConfidence: "high",
  };
}

const sessions = [
  session("dropped", "Evals in Production", 14),
  session("clash", "Payer fireside", 14),
  session("other", "Morning keynote", 9),
];

const goals = [
  { id: "g1", label: "AI evaluation", weight: 5 },
  { id: "g2", label: "Payer partnerships", weight: 2 },
];

const scores = [
  { sessionId: "dropped", goalId: "g1", relevance: 0.9, reason: "", model: "test" },
  { sessionId: "dropped", goalId: "g2", relevance: 0.1, reason: "", model: "test" },
  { sessionId: "clash", goalId: "g1", relevance: 0.1, reason: "", model: "test" },
  { sessionId: "clash", goalId: "g2", relevance: 0.8, reason: "", model: "test" },
  { sessionId: "other", goalId: "g1", relevance: 0.1, reason: "", model: "test" },
  { sessionId: "other", goalId: "g2", relevance: 0.1, reason: "", model: "test" },
];

const members = [
  { id: "maya", displayName: "Maya" },
  { id: "busy", displayName: "Busy" },
  { id: "blocked", displayName: "Blocked" },
];

const base: CoverInput = {
  sessions,
  goals,
  scores,
  members,
  assignments: [
    { sessionId: "clash", membershipId: "busy", pinned: false, reason: "fixture" },
    { sessionId: "other", membershipId: "maya", pinned: false, reason: "fixture" },
  ],
  blocks: [
    {
      membershipId: "blocked",
      startsAt: Date.UTC(2026, 1, 22, 13, 30),
      endsAt: Date.UTC(2026, 1, 22, 15, 30),
      reason: "customer lunch",
    },
  ],
  preferences: [{ membershipId: "maya", sessionId: "dropped", stance: "interested" }],
};

describe("rankCoverCandidates", () => {
  it("excludes a teammate who is booked at that time", () => {
    const names = rankCoverCandidates(base, "dropped").map((c) => c.membershipId);
    expect(names).not.toContain("busy");
  });

  it("excludes a teammate blocked at that time", () => {
    const names = rankCoverCandidates(base, "dropped").map((c) => c.membershipId);
    expect(names).not.toContain("blocked");
  });

  it("picks the free teammate and reports a real coverage gain", () => {
    const [best] = rankCoverCandidates(base, "dropped");
    expect(best?.membershipId).toBe("maya");
    expect(best?.coverageGain).toBeGreaterThan(0);
    expect(best?.topGoalLabel).toBe("AI evaluation");
  });

  it("explains itself from score terms, not prose", () => {
    const [best] = rankCoverCandidates(base, "dropped");
    expect(best?.reasons).toContain("No schedule conflict");
    expect(best?.reasons).toContain("Already marked interested in this session");
    expect(best?.reasons.some((r) => r.includes("AI evaluation"))).toBe(true);
  });

  it("returns nothing for an unknown session", () => {
    expect(rankCoverCandidates(base, "nope")).toEqual([]);
  });

  it("is deterministic", () => {
    const first = rankCoverCandidates(base, "dropped");
    const second = rankCoverCandidates(base, "dropped");
    expect(first).toEqual(second);
  });
});

describe("cover reasons", () => {
  it("never claims it restores 0.0 points", () => {
    const tinyGain: CoverInput = {
      ...base,
      scores: scores.map((score) => ({ ...score, relevance: 0.01 })),
    };

    for (const candidate of rankCoverCandidates(tinyGain, "dropped")) {
      expect(candidate.reasons.some((reason) => reason.includes("0.0"))).toBe(false);
      expect(candidate.reasons.length).toBeGreaterThan(1);
    }
  });
});
