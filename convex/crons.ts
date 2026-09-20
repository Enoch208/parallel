import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const takeawayWindowMinutes = 5;

const crons = cronJobs();

crons.interval(
  "takeaway prompts due",
  { minutes: takeawayWindowMinutes },
  internal.notes.recordDueTakeawayPrompts,
  { windowMinutes: takeawayWindowMinutes },
);

crons.interval("watch published agendas", { minutes: 30 }, internal.agendaSweep.sweepAgendas, {
  trigger: "Scheduled sweep",
});

crons.interval("clean up guest workspaces", { hours: 6 }, internal.guest.cleanupExpiredGuests, {});

export default crons;
