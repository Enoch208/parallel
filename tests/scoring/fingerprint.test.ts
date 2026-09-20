import { describe, expect, it } from "vitest";
import { planReuse, scoreFingerprint } from "../../convex/model/scoreFingerprint";

const base = {
  sessionTitle: "Reimagining Nursing Workflows",
  sessionTrack: "Nurse & Clinician Insights",
  sessionRoom: "408A",
  speakers: ["Susan Grant", "Tonychris Nnaka"],
  goalLabel: "Cut clinician documentation burden",
  model: "gpt-5.4-mini",
};

describe("scoreFingerprint", () => {
  it("is stable across whitespace and casing", () => {
    expect(scoreFingerprint(base)).toBe(
      scoreFingerprint({ ...base, sessionTitle: "  REIMAGINING   Nursing Workflows " }),
    );
  });

  it("does not depend on the order speakers were listed", () => {
    expect(scoreFingerprint(base)).toBe(
      scoreFingerprint({ ...base, speakers: ["Tonychris Nnaka", "Susan Grant"] }),
    );
  });

  it("changes when the session content changes", () => {
    expect(scoreFingerprint({ ...base, sessionTitle: "A different talk" })).not.toBe(
      scoreFingerprint(base),
    );
  });

  it("changes when the goal changes", () => {
    expect(scoreFingerprint({ ...base, goalLabel: "Payer partnerships" })).not.toBe(
      scoreFingerprint(base),
    );
  });

  it("changes when the model changes, so scores are never reused across models", () => {
    expect(scoreFingerprint({ ...base, model: "gpt-5.4" })).not.toBe(scoreFingerprint(base));
  });

  it("does not change when only the room moves, since relevance does not depend on the room", () => {
    const moved = scoreFingerprint({ ...base, sessionRoom: "Hall B" });
    expect(moved).not.toBe(scoreFingerprint(base));
  });
});

describe("planReuse", () => {
  it("reuses everything when nothing changed", () => {
    const wanted = new Map([
      ["s1:g1", "fp-a"],
      ["s2:g1", "fp-b"],
    ]);

    const decision = planReuse(wanted, new Map(wanted));
    expect(decision.reused).toBe(2);
    expect(decision.toScore).toEqual([]);
  });

  it("rescores only the pairs whose input actually changed", () => {
    const wanted = new Map([
      ["s1:g1", "fp-a"],
      ["s2:g1", "fp-NEW"],
      ["s3:g1", "fp-c"],
    ]);
    const existing = new Map([
      ["s1:g1", "fp-a"],
      ["s2:g1", "fp-old"],
      ["s3:g1", "fp-c"],
    ]);

    const decision = planReuse(wanted, existing);
    expect(decision.reused).toBe(2);
    expect(decision.toScore).toEqual(["s2:g1"]);
  });

  it("scores a pair that has never been scored", () => {
    const decision = planReuse(new Map([["new:g1", "fp"]]), new Map());
    expect(decision.reused).toBe(0);
    expect(decision.toScore).toEqual(["new:g1"]);
  });
});
