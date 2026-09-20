import { describe, expect, it } from "vitest";
import { buildIdempotencyKey } from "../../convex/model/agentmailClient";
import { planReuse, scoreFingerprint } from "../../convex/model/scoreFingerprint";
import type { FingerprintInput } from "../../convex/model/scoreFingerprint";

const kinds = ["plan", "cover_request", "takeaway_prompt", "brief"];
const members = ["m_ada", "m_bob"];
const revisions = [0, 1, 2, 17];

describe("outbound idempotency keys", () => {
  it("rebuilds the same key for the same kind, teammate and revision on every retry", () => {
    const attempts = Array.from({ length: 50 }, () => buildIdempotencyKey("plan", "m_ada", 4));

    expect(new Set(attempts).size).toBe(1);
    expect(buildIdempotencyKey("plan", "m_ada", 4)).toBe(
      buildIdempotencyKey("plan", "m_ada", 4, ""),
    );
  });

  it("changes when the plan revision moves, so a republished plan does send again", () => {
    expect(buildIdempotencyKey("plan", "m_ada", 4)).not.toBe(
      buildIdempotencyKey("plan", "m_ada", 5),
    );
    expect(buildIdempotencyKey("plan", "m_ada", 4)).not.toBe(
      buildIdempotencyKey("plan", "m_ada", 40),
    );
  });

  it("never collides across kinds, teammates, revisions and scopes", () => {
    const keys: string[] = [];

    for (const kind of kinds) {
      for (const membershipId of members) {
        for (const planRevision of revisions) {
          keys.push(buildIdempotencyKey(kind, membershipId, planRevision));
          keys.push(buildIdempotencyKey(kind, membershipId, planRevision, "req_1"));
          keys.push(buildIdempotencyKey(kind, membershipId, planRevision, "req_2"));
        }
      }
    }

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("separates two cover requests raised against one revision", () => {
    expect(buildIdempotencyKey("cover_request", "m_ada", 3, "req_1")).not.toBe(
      buildIdempotencyKey("cover_request", "m_ada", 3, "req_2"),
    );
  });

  it("treats a negative zero revision as zero rather than as a separate send", () => {
    expect(buildIdempotencyKey("plan", "m_ada", -0)).toBe(buildIdempotencyKey("plan", "m_ada", 0));
  });

  it("collides when a field carries the colon it joins on, which only the shape of a Convex id prevents", () => {
    expect(buildIdempotencyKey("plan:m_ada", "1", 2)).toBe(
      buildIdempotencyKey("plan", "m_ada", 1, "2"),
    );
  });
});

const model = "gpt-5-mini";

function pair(sessionTitle: string, goalLabel: string, overrides: Partial<FingerprintInput> = {}) {
  const input: FingerprintInput = {
    sessionTitle,
    sessionTrack: "Platform",
    sessionRoom: "Hall A",
    speakers: ["Ada Lovelace", "Alan Turing"],
    goalLabel,
    model,
    ...overrides,
  };

  return scoreFingerprint(input);
}

const sessionIds = ["s1", "s2", "s3"];
const goalIds = ["g1", "g2"];
const titles = new Map([
  ["s1", "Scaling Postgres"],
  ["s2", "Vector search 101"],
  ["s3", "Keynote"],
]);
const labels = new Map([
  ["g1", "Ship faster"],
  ["g2", "Cut infra spend"],
]);

function wantedMap(
  titleFor: ReadonlyMap<string, string>,
  labelFor: ReadonlyMap<string, string>,
  scoringModel: string,
): Map<string, string> {
  const wanted = new Map<string, string>();

  for (const sessionId of sessionIds) {
    for (const goalId of goalIds) {
      wanted.set(
        `${sessionId}\u0000${goalId}`,
        pair(titleFor.get(sessionId) ?? "", labelFor.get(goalId) ?? "", { model: scoringModel }),
      );
    }
  }

  return wanted;
}

describe("score reuse", () => {
  const existing = wantedMap(titles, labels, model);

  it("reuses everything when nothing moved", () => {
    expect(planReuse(wantedMap(titles, labels, model), existing)).toEqual({
      reused: 6,
      toScore: [],
    });
  });

  it("invalidates only the pairs of the session that changed", () => {
    const retitled = new Map(titles).set("s2", "Vector search, from scratch");
    const decision = planReuse(wantedMap(retitled, labels, model), existing);

    expect(decision.reused).toBe(4);
    expect([...decision.toScore].sort()).toEqual(["s2\u0000g1", "s2\u0000g2"]);
  });

  it("invalidates only the pairs of the goal that changed", () => {
    const relabelled = new Map(labels).set("g2", "Cut cloud spend");
    const decision = planReuse(wantedMap(titles, relabelled, model), existing);

    expect(decision.reused).toBe(3);
    expect([...decision.toScore].sort()).toEqual(["s1\u0000g2", "s2\u0000g2", "s3\u0000g2"]);
  });

  it("invalidates every pair when the scoring model changes", () => {
    const decision = planReuse(wantedMap(titles, labels, "gpt-5"), existing);

    expect(decision.reused).toBe(0);
    expect(decision.toScore).toHaveLength(6);
  });

  it("invalidates nothing for whitespace, casing or speaker ordering", () => {
    const noisy = new Map(
      sessionIds.map((id) => [id, `  ${(titles.get(id) ?? "").toUpperCase()}  `]),
    );
    const decision = planReuse(wantedMap(noisy, labels, model), existing);

    expect(decision).toEqual({ reused: 6, toScore: [] });
    expect(pair("A talk", "A goal", { speakers: ["Turing", "Lovelace"] })).toBe(
      pair("A talk", "A goal", { speakers: ["Lovelace", "Turing"] }),
    );
    expect(pair("A talk", "A goal", { speakers: ["  turing ", "LOVELACE"] })).toBe(
      pair("A talk", "A goal", { speakers: ["Lovelace", "Turing"] }),
    );
  });

  it("invalidates when the track changes but not when only the room moves", () => {
    expect(pair("A talk", "A goal", { sessionTrack: "Data" })).not.toBe(pair("A talk", "A goal"));
    expect(pair("A talk", "A goal", { sessionRoom: "Hall B" })).not.toBe(pair("A talk", "A goal"));
    expect(pair("A talk", "A goal", { sessionRoom: null })).not.toBe(
      pair("A talk", "A goal", { sessionTrack: null }),
    );
  });

  it("scores a pair that was never scored and forgets nothing that vanished", () => {
    const wanted = new Map([["s9\u0000g1", pair("Brand new", "Ship faster")]]);

    expect(planReuse(wanted, existing)).toEqual({ reused: 0, toScore: ["s9\u0000g1"] });
    expect(planReuse(new Map(), existing)).toEqual({ reused: 0, toScore: [] });
  });

  it("cannot tell one merged speaker string from two speakers, so that re-import reuses a stale score", () => {
    expect(pair("A talk", "A goal", { speakers: ["Ada Lovelace,Alan Turing"] })).toBe(
      pair("A talk", "A goal", { speakers: ["Ada Lovelace", "Alan Turing"] }),
    );
  });

  it("cannot tell a pipe moving between a goal label and a session title, so that edit reuses a stale score", () => {
    expect(pair("c", "a|b")).toBe(pair("b|c", "a"));
  });
});
