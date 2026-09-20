import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { scoreFingerprint } from "./model/scoreFingerprint";

export const reuseReport = internalQuery({
  args: { conferenceId: v.id("conferences"), model: v.string() },
  handler: async (ctx, args) => {
    const [sessions, goals, scores] = await Promise.all([
      ctx.db
        .query("sessions")
        .withIndex("by_conference_start", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
      ctx.db
        .query("sessionGoalScores")
        .withIndex("by_conference", (q) => q.eq("conferenceId", args.conferenceId))
        .collect(),
    ]);

    const stored = new Map(
      scores.map((score) => [`${score.sessionId}:${score.goalId}`, score.inputFingerprint ?? null]),
    );

    const staleSessions = new Set<string>();
    let reusable = 0;
    let needed = 0;

    for (const session of sessions) {
      for (const goal of goals) {
        const fingerprint = scoreFingerprint({
          sessionTitle: session.title,
          sessionTrack: session.track,
          sessionRoom: session.room,
          speakers: session.speakers,
          goalLabel: goal.label,
          model: args.model,
        });

        const current = stored.get(`${session._id}:${goal._id}`);

        if (current !== undefined && current === fingerprint) {
          reusable += 1;
        } else {
          needed += 1;
          staleSessions.add(session._id);
        }
      }
    }

    return {
      totalPairs: sessions.length * goals.length,
      reusable,
      needed,
      staleSessionIds: [...staleSessions],
      sessions: sessions.length,
      goals: goals.length,
    };
  },
});
