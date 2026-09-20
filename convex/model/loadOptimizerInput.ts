import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { OptimizerInput } from "../engine";
import type { RelevanceScore, SessionSummary } from "./types";

export async function loadOptimizerInput(
  ctx: QueryCtx,
  conferenceId: Id<"conferences">,
  agendaUrl: string,
): Promise<OptimizerInput> {
  const conference = await ctx.db.get(conferenceId);

  if (conference === null) {
    throw new Error("Conference not found");
  }

  const [sessionRows, goalRows, scoreRows, preferenceRows, blockRows, memberRows] =
    await Promise.all([
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", conferenceId))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect(),
      ctx.db
        .query("sessionGoalScores")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect(),
      ctx.db
        .query("memberPreferences")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect(),
      ctx.db
        .query("availabilityBlocks")
        .withIndex("by_conference", (q) => q.eq("conferenceId", conferenceId))
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_team", (q) => q.eq("teamId", conference.teamId))
        .collect(),
    ]);

  const sessions: SessionSummary[] = sessionRows.map((session) => ({
    id: session._id,
    title: session.title,
    track: session.track,
    room: session.room,
    speakers: session.speakers,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    sourceUrl: agendaUrl,
    titleConfidence: session.titleConfidence,
    timeConfidence: session.timeConfidence,
    roomConfidence: session.roomConfidence,
  }));

  const scores: RelevanceScore[] = scoreRows.map((score) => ({
    sessionId: score.sessionId,
    goalId: score.goalId,
    relevance: score.relevance,
    reason: score.reason,
    model: score.model,
  }));

  return {
    sessions,
    goals: goalRows.map((goal) => ({ id: goal._id, label: goal.label, weight: goal.weight })),
    scores,
    members: memberRows.map((member) => ({ id: member._id, displayName: member.displayName })),
    preferences: preferenceRows.map((preference) => ({
      membershipId: preference.membershipId,
      sessionId: preference.sessionId,
      stance: preference.stance,
    })),
    blocks: blockRows.map((block) => ({
      membershipId: block.membershipId,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      reason: block.reason,
    })),
  };
}
