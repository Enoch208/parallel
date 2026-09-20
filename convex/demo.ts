import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  demoConference,
  demoGoals,
  demoMembers,
  demoScoreModel,
  demoSessions,
  demoSource,
  demoStackedSessionKeys,
  demoTeamName,
} from "./model/demoFixture";

export const seedDemoWorkspace = mutation({
  args: {},
  returns: v.id("conferences"),
  handler: async (ctx) => {
    const teamId = await ctx.db.insert("teams", { name: demoTeamName, isDemo: true });

    const membershipIds = await Promise.all(
      demoMembers.map((member) =>
        ctx.db.insert("memberships", {
          teamId,
          displayName: member.displayName,
          email: member.email,
          isLead: member.isLead,
        }),
      ),
    );

    const conferenceId = await ctx.db.insert("conferences", {
      teamId,
      name: demoConference.name,
      agendaUrl: demoConference.agendaUrl,
      timezone: demoConference.timezone,
      constraintRevision: demoConference.constraintRevision,
      isDemoData: true,
    });

    const sourceId = await ctx.db.insert("sources", {
      conferenceId,
      url: demoSource.url,
      fetchedAt: demoSource.fetchedAt,
      contentHash: demoSource.contentHash,
    });

    const seededGoals = await Promise.all(
      demoGoals.map(async (goal) => ({
        key: goal.key,
        goalId: await ctx.db.insert("goals", {
          conferenceId,
          label: goal.label,
          weight: goal.weight,
        }),
      })),
    );

    const seededSessions = await Promise.all(
      demoSessions.map(async (session) => ({
        fixture: session,
        sessionId: await ctx.db.insert("sessions", {
          conferenceId,
          sourceId,
          externalKey: session.externalKey,
          title: session.title,
          track: session.track,
          room: session.room,
          speakers: [...session.speakers],
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          titleConfidence: session.titleConfidence,
          timeConfidence: session.timeConfidence,
          roomConfidence: session.roomConfidence,
        }),
      })),
    );

    await Promise.all(
      seededSessions.flatMap(({ fixture, sessionId }) =>
        seededGoals.map(({ key, goalId }) =>
          ctx.db.insert("sessionGoalScores", {
            conferenceId,
            sessionId,
            goalId,
            relevance: fixture.scores[key].relevance,
            reason: fixture.scores[key].reason,
            model: demoScoreModel,
          }),
        ),
      ),
    );

    const stackedSessions = seededSessions.filter(({ fixture }) =>
      demoStackedSessionKeys.includes(fixture.externalKey),
    );

    await Promise.all(
      membershipIds.flatMap((membershipId) =>
        stackedSessions.map(({ sessionId }) =>
          ctx.db.insert("memberPreferences", {
            conferenceId,
            membershipId,
            sessionId,
            stance: "interested",
          }),
        ),
      ),
    );

    return conferenceId;
  },
});
