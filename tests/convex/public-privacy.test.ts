import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { freshHarness, seedCoverScenario } from "./fixtures";

const rawAddress = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

async function workspaceWithMail(t: ReturnType<typeof freshHarness>, frozen: boolean) {
  return t.run(async (ctx) => {
    const fixture = await seedCoverScenario(ctx);
    await ctx.db.insert("assignments", {
      planId: fixture.planId,
      conferenceId: fixture.conferenceId,
      sessionId: fixture.droppedSessionId,
      membershipId: fixture.covererId,
      pinned: false,
      reason: "Covering after a teammate dropped out",
    });
    await ctx.db.insert("emailEvents", {
      conferenceId: fixture.conferenceId,
      providerEventId: "evt-private",
      direction: "inbound",
      kind: "message.received",
      membershipId: fixture.leaverId,
      subject: "Re: your plan",
      body: "Is this plan final?",
      intent: "question",
      confidence: 0.9,
      quote: "Is this plan final?",
      fromAddress: "ada@example.com",
      handled: false,
    });
    await ctx.db.insert("activity", {
      conferenceId: fixture.conferenceId,
      kind: "reply_received",
      sponsor: "agentmail",
      durationMs: 0,
      summary: "Reply received from ada@example.com",
    });
    await ctx.db.insert("briefRecipients", {
      conferenceId: fixture.conferenceId,
      email: "sponsor@example.org",
      addedBy: fixture.leaverId,
    });
    await ctx.db.insert("briefs", {
      conferenceId: fixture.conferenceId,
      body: "# Brief",
      model: "test",
      recipients: ["ada@example.com"],
      tripCostEstimate: null,
      sentAt: 1,
    });
    await ctx.db.patch(fixture.conferenceId, { frozen });
    return fixture.conferenceId;
  });
}

async function publicResponses(
  t: ReturnType<typeof freshHarness>,
  conferenceId: Id<"conferences">,
) {
  return {
    overview: await t.query(api.board.conferenceOverview, { conferenceId }),
    preferences: await t.query(api.board.memberPreferences, { conferenceId }),
    assignments: await t.query(api.evidence.assignmentProvenance, { conferenceId }),
    trail: await t.query(api.evidence.constraintTrail, { conferenceId }),
    activity: await t.query(api.activity.recent, { conferenceId }),
    recipients: await t.query(api.notes.briefRecipients, { conferenceId }),
    brief: await t.query(api.brief.latest, { conferenceId }),
  };
}

it("a frozen workspace's team overview never returns a raw email address", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithMail(t, true);
  const { overview, preferences } = await publicResponses(t, conferenceId);

  expect(JSON.stringify(overview)).not.toMatch(rawAddress);
  expect(JSON.stringify(preferences)).not.toMatch(rawAddress);
  expect(overview?.members.map((member) => member.email)).toContain("a•••@example.com");
});

it("a frozen workspace's assignment evidence never returns a raw email address", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithMail(t, true);
  const { assignments } = await publicResponses(t, conferenceId);

  expect(JSON.stringify(assignments)).not.toMatch(rawAddress);
});

it("a frozen workspace masks every inbound sender on Evidence, not only judge emails", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithMail(t, true);
  const { trail } = await publicResponses(t, conferenceId);

  expect(JSON.stringify(trail)).not.toMatch(rawAddress);
  expect(trail.unlinkedReplies[0]?.fromAddress).toBe("a•••@example.com");
});

it("a frozen workspace's activity and brief recipients carry no raw email address", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithMail(t, true);
  const { activity, recipients, brief } = await publicResponses(t, conferenceId);

  expect(JSON.stringify(activity)).not.toMatch(rawAddress);
  expect(JSON.stringify(recipients)).not.toMatch(rawAddress);
  expect(JSON.stringify(brief?.brief?.recipients)).not.toMatch(rawAddress);
  expect(activity[0]?.summary).toBe("Reply received from a•••@example.com");
});

it("a workspace that is not frozen still shows its lead the real addresses", async () => {
  const t = freshHarness();
  const conferenceId = await workspaceWithMail(t, false);
  const { overview, recipients } = await publicResponses(t, conferenceId);

  expect(overview?.members.map((member) => member.email)).toContain("ada@example.com");
  expect(recipients.map((row) => row.email)).toContain("sponsor@example.org");
});
