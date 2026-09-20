import { describe, expect, it } from "vitest";
import { parseBrief } from "../../convex/model/briefSchema";

describe("brief defensive parser", () => {
  it("throws when the payload has no sections array", () => {
    expect(() => parseBrief({})).toThrow("Brief payload had no sections array");
    expect(() => parseBrief({ sections: "nope" })).toThrow(
      "Brief payload sections was not an array",
    );
    expect(() => parseBrief(null)).toThrow("Brief payload had no sections array");
  });

  it("keeps well formed sections and claims", () => {
    const parsed = parseBrief({
      sections: [
        {
          goalId: "g1",
          goalLabel: "Automate revenue cycle",
          claims: [{ statement: "  Trimmed  ", sourceKind: "note", sourceId: "n1" }],
        },
      ],
    });

    expect(parsed.malformedSections).toBe(0);
    expect(parsed.malformedClaims).toBe(0);
    expect(parsed.sections).toEqual([
      {
        goalId: "g1",
        goalLabel: "Automate revenue cycle",
        claims: [{ statement: "Trimmed", sourceKind: "note", sourceId: "n1" }],
      },
    ]);
  });

  it("drops malformed sections rather than coercing them", () => {
    const parsed = parseBrief({
      sections: [
        null,
        "a string",
        { goalId: 7, goalLabel: "Numeric id", claims: [] },
        { goalId: "g1", goalLabel: "No claims array" },
        { goalId: "g2", goalLabel: "Kept", claims: [] },
      ],
    });

    expect(parsed.malformedSections).toBe(4);
    expect(parsed.sections.map((section) => section.goalId)).toEqual(["g2"]);
  });

  it("drops malformed claims rather than coercing them", () => {
    const parsed = parseBrief({
      sections: [
        {
          goalId: "g1",
          goalLabel: "Kept",
          claims: [
            { statement: "", sourceKind: "note", sourceId: "n1" },
            { statement: "No source id", sourceKind: "note", sourceId: "" },
            { statement: "Unknown kind", sourceKind: "webpage", sourceId: "n1" },
            { statement: "Numeric source", sourceKind: "note", sourceId: 42 },
            null,
            { statement: "Kept claim", sourceKind: "session", sourceId: "s1" },
          ],
        },
      ],
    });

    expect(parsed.malformedClaims).toBe(5);
    expect(parsed.sections[0]?.claims).toEqual([
      { statement: "Kept claim", sourceKind: "session", sourceId: "s1" },
    ]);
  });
});
