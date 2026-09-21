import { describe, expect, it } from "vitest";
import { assessScoring, describeScoring } from "../../convex/model/scoringCompleteness";

describe("deciding whether an import finished scoring", () => {
  it("calls a full matrix complete", () => {
    const result = assessScoring({ sessions: 9, goals: 4, scoredPairs: 36 });

    expect(result).toEqual({ expectedPairs: 36, scoredPairs: 36, missing: 0, complete: true });
  });

  it("refuses to call a matrix one pair short complete", () => {
    const result = assessScoring({ sessions: 9, goals: 4, scoredPairs: 35 });

    expect(result.complete).toBe(false);
    expect(result.missing).toBe(1);
  });

  it("never reports a negative shortfall when more rows exist than expected", () => {
    const result = assessScoring({ sessions: 2, goals: 2, scoredPairs: 5 });

    expect(result.missing).toBe(0);
    expect(result.complete).toBe(true);
  });

  it("says plainly what was left unscored and that a retry was tried", () => {
    const summary = describeScoring(
      assessScoring({ sessions: 9, goals: 4, scoredPairs: 34 }),
      true,
    );

    expect(summary).toContain("34 of 36");
    expect(summary).toContain("after a retry");
    expect(summary).toContain("2 left unscored");
  });

  it("does not claim a retry happened when the first pass was already complete", () => {
    const summary = describeScoring(
      assessScoring({ sessions: 9, goals: 4, scoredPairs: 36 }),
      false,
    );

    expect(summary).toBe("Scored all 36 session and goal pairs");
  });
});
