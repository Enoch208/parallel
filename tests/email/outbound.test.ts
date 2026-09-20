import { describe, expect, it } from "vitest";
import {
  buildIdempotencyKey,
  coverEmailBody,
  planEmailBody,
  slotLabel,
  subjectWithToken,
  type PlanEmailSession,
} from "../../convex/model/agentmailClient";
import { tokenFromSubject } from "../../convex/model/threadRouting";

const timezone = "America/Los_Angeles";
const morning = Date.UTC(2026, 8, 22, 16, 0);
const afternoon = Date.UTC(2026, 8, 22, 21, 0);

const sessions: PlanEmailSession[] = [
  {
    title: "Evals in Production",
    startsAt: morning,
    endsAt: morning + 60 * 60 * 1000,
    room: "Golden Gate A",
    reason: "Covers AI evaluation, the team's heaviest goal",
  },
  {
    title: "Payer integrations fireside",
    startsAt: afternoon,
    endsAt: afternoon + 45 * 60 * 1000,
    room: null,
    reason: "Only session touching reimbursement",
  },
];

describe("buildIdempotencyKey", () => {
  it("keys a plan send on kind, teammate and plan revision", () => {
    expect(buildIdempotencyKey("plan", "member_abc", 3)).toBe("plan:member_abc:3");
  });

  it("changes when the plan revision moves so a new plan does send", () => {
    expect(buildIdempotencyKey("plan", "member_abc", 3)).not.toBe(
      buildIdempotencyKey("plan", "member_abc", 4),
    );
  });

  it("stays stable across retries of the same send", () => {
    expect(buildIdempotencyKey("plan", "member_abc", 3)).toBe(
      buildIdempotencyKey("plan", "member_abc", 3),
    );
  });

  it("separates two teammates on the same revision", () => {
    expect(buildIdempotencyKey("plan", "member_abc", 3)).not.toBe(
      buildIdempotencyKey("plan", "member_xyz", 3),
    );
  });

  it("adds a scope so two cover requests at one revision are distinct", () => {
    expect(buildIdempotencyKey("cover_request", "member_abc", 3, "request_1")).toBe(
      "cover_request:member_abc:3:request_1",
    );
    expect(buildIdempotencyKey("cover_request", "member_abc", 3, "request_1")).not.toBe(
      buildIdempotencyKey("cover_request", "member_abc", 3, "request_2"),
    );
  });
});

describe("slotLabel", () => {
  it("falls back to UTC and says so rather than throwing on a legacy bad zone", () => {
    const morning = Date.UTC(2026, 8, 22, 9, 0, 0);
    expect(() => slotLabel(morning, morning + 60 * 60 * 1000, "Not/AZone")).not.toThrow();
    expect(slotLabel(morning, morning + 60 * 60 * 1000, "Not/AZone")).toBe(
      "Tue 22 Sep 09:00-10:00 UTC",
    );
  });

  it("renders the day and the time range in the venue timezone", () => {
    expect(slotLabel(morning, morning + 60 * 60 * 1000, timezone)).toBe("Tue 22 Sep 09:00-10:00");
  });

  it("uses a 24 hour clock past noon", () => {
    expect(slotLabel(afternoon, afternoon + 45 * 60 * 1000, timezone)).toBe(
      "Tue 22 Sep 14:00-14:45",
    );
  });
});

describe("subjectWithToken", () => {
  it("puts the routing token in the [PL-XXXX] form", () => {
    expect(subjectWithToken("Your AI Summit plan", "K7Q2")).toBe("Your AI Summit plan [PL-K7Q2]");
  });

  it("produces a subject the inbound router can read the token back from", () => {
    const subject = subjectWithToken('Can you cover "Evals in Production"?', "K7Q2");
    expect(tokenFromSubject(subject)).toBe("K7Q2");
    expect(tokenFromSubject(`Re: ${subject}`)).toBe("K7Q2");
  });
});

describe("planEmailBody", () => {
  const body = planEmailBody({
    displayName: "Ada",
    conferenceName: "AI Summit",
    timezone,
    sessions,
  });

  it("writes every session with its slot, room, title and reason", () => {
    expect(body).toBe(
      [
        "Hi Ada,",
        "",
        "Here is your plan for AI Summit. Times are local to the venue.",
        "",
        "1. Tue 22 Sep 09:00-10:00 · Golden Gate A",
        "   Evals in Production",
        "   Why: Covers AI evaluation, the team's heaviest goal",
        "",
        "2. Tue 22 Sep 14:00-14:45",
        "   Payer integrations fireside",
        "   Why: Only session touching reimbursement",
        "",
        'If something does not work, reply to this email in your own words — "I cannot make the 14:00" is enough and the plan updates itself.',
      ].join("\n"),
    );
  });

  it("keeps the stored reason verbatim", () => {
    for (const session of sessions) {
      expect(body).toContain(`Why: ${session.reason}`);
    }
  });

  it("leaves the room off a session that has none", () => {
    expect(body).not.toContain("· null");
  });
});

describe("coverEmailBody", () => {
  const body = coverEmailBody({
    displayName: "Ben",
    droppedBy: "Ada",
    sessionTitle: "Evals in Production",
    startsAt: morning,
    endsAt: morning + 60 * 60 * 1000,
    room: "Golden Gate A",
    timezone,
    reasons: ["Free at 09:00", "Adds 4.2 Team Goal Coverage on AI evaluation"],
  });

  it("names who dropped out and when the session runs", () => {
    expect(body).toContain(
      'Ada can no longer attend "Evals in Production" (Tue 22 Sep 09:00-10:00 · Golden Gate A).',
    );
  });

  it("lists every stored reason verbatim", () => {
    expect(body).toContain("- Free at 09:00");
    expect(body).toContain("- Adds 4.2 Team Goal Coverage on AI evaluation");
  });

  it("asks for a YES reply", () => {
    expect(body).toContain("Reply YES");
  });
});
