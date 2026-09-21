import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const watchedConferences = internalQuery({
  args: { agendaUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const conferences = await ctx.db.query("conferences").collect();

    return conferences
      .filter((conference) => !conference.isDemoData && conference.frozen !== true)
      .filter(
        (conference) => args.agendaUrl === undefined || conference.agendaUrl === args.agendaUrl,
      )
      .map((conference) => ({ id: conference._id, agendaUrl: conference.agendaUrl }));
  },
});

export const recordSweep = internalMutation({
  args: { checked: v.number(), changed: v.number(), trigger: v.string() },
  handler: async (ctx, args) => {
    const conferences = await ctx.db.query("conferences").collect();
    const target = conferences.find((conference) => !conference.isDemoData);

    if (target === undefined) {
      return { recorded: false };
    }

    await ctx.db.insert("activity", {
      conferenceId: target._id,
      kind: "agenda_sweep",
      sponsor: "firecrawl",
      durationMs: 0,
      summary: `${args.trigger}: checked ${String(args.checked)} agenda${args.checked === 1 ? "" : "s"}, ${String(args.changed)} had changed since the last fetch`,
    });

    return { recorded: true };
  },
});

export const checkOne = internalAction({
  args: { conferenceId: v.id("conferences") },
  handler: async (ctx, args): Promise<{ changed: number }> => {
    const outcome = await ctx.runAction(api.agendaWatch.detectAgendaChange, {
      conferenceId: args.conferenceId,
    });

    return { changed: outcome.changed };
  },
});

export const sweepAgendas = internalAction({
  args: { agendaUrl: v.optional(v.string()), trigger: v.string() },
  handler: async (ctx, args): Promise<{ checked: number; changed: number }> => {
    const targets = await ctx.runQuery(internal.agendaSweep.watchedConferences, {
      ...(args.agendaUrl === undefined ? {} : { agendaUrl: args.agendaUrl }),
    });

    let changed = 0;

    for (const target of targets) {
      const result = await ctx.runAction(internal.agendaSweep.checkOne, {
        conferenceId: target.id,
      });

      if (result.changed > 0) {
        changed += 1;
      }
    }

    await ctx.runMutation(internal.agendaSweep.recordSweep, {
      checked: targets.length,
      changed,
      trigger: args.trigger,
    });

    return { checked: targets.length, changed };
  },
});
