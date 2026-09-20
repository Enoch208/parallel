import { describe, expect, it } from "vitest";
import { renderBriefBody, verifyBriefSources } from "../../convex/model/briefSchema";
import type { BriefSection, KnownSources } from "../../convex/model/briefSchema";

const known: KnownSources = {
  goalIds: new Set(["goal-rcm", "goal-docs"]),
  noteIds: new Set(["note-1", "note-2"]),
  sessionIds: new Set(["session-1"]),
};

function section(goalId: string, claims: BriefSection["claims"]): BriefSection {
  return { goalId, goalLabel: `Label for ${goalId}`, claims };
}

describe("brief source verification", () => {
  it("keeps claims that cite an id that was passed in", () => {
    const verified = verifyBriefSources(
      [
        section("goal-rcm", [
          { statement: "Denials fell after automation", sourceKind: "note", sourceId: "note-1" },
          {
            statement: "The team attended the RCM workshop",
            sourceKind: "session",
            sourceId: "session-1",
          },
        ]),
      ],
      known,
    );

    expect(verified.sections).toHaveLength(1);
    expect(verified.sections[0]?.claims).toHaveLength(2);
    expect(verified.unknownSourceClaims).toBe(0);
    expect(verified.unknownGoalSections).toBe(0);
    expect(verified.emptiedSections).toBe(0);
  });

  it("drops a claim that cites a note id nobody passed in", () => {
    const verified = verifyBriefSources(
      [
        section("goal-rcm", [
          { statement: "Grounded claim", sourceKind: "note", sourceId: "note-2" },
          { statement: "Invented claim", sourceKind: "note", sourceId: "note-999" },
        ]),
      ],
      known,
    );

    expect(verified.unknownSourceClaims).toBe(1);
    expect(verified.sections[0]?.claims.map((claim) => claim.statement)).toEqual([
      "Grounded claim",
    ]);
  });

  it("drops a claim that cites a session id as a note id", () => {
    const verified = verifyBriefSources(
      [
        section("goal-docs", [
          { statement: "Mislabelled source", sourceKind: "note", sourceId: "session-1" },
        ]),
      ],
      known,
    );

    expect(verified.unknownSourceClaims).toBe(1);
    expect(verified.sections).toHaveLength(0);
    expect(verified.emptiedSections).toBe(1);
  });

  it("drops a whole section that cites an unknown goal", () => {
    const verified = verifyBriefSources(
      [
        section("goal-invented", [
          { statement: "Grounded claim", sourceKind: "note", sourceId: "note-1" },
        ]),
        section("goal-docs", [
          { statement: "Another grounded claim", sourceKind: "note", sourceId: "note-2" },
        ]),
      ],
      known,
    );

    expect(verified.unknownGoalSections).toBe(1);
    expect(verified.unknownSourceClaims).toBe(0);
    expect(verified.sections.map((entry) => entry.goalId)).toEqual(["goal-docs"]);
  });
});

describe("brief rendering", () => {
  it("carries the source id and its label on every claim", () => {
    const body = renderBriefBody(
      "ViVE 2026",
      [
        section("goal-rcm", [
          { statement: "Denials fell after automation", sourceKind: "note", sourceId: "note-1" },
        ]),
      ],
      new Map([["note-1", "Priya on Building Better RCM Automation"]]),
    );

    expect(body).toContain("# ViVE 2026: what the team learned");
    expect(body).toContain("## Label for goal-rcm");
    expect(body).toContain(
      "- Denials fell after automation\n  Source: Priya on Building Better RCM Automation [note:note-1]",
    );
  });

  it("says plainly when nothing survived verification", () => {
    const body = renderBriefBody("ViVE 2026", [], new Map());
    expect(body).toContain("no claims");
  });
});
