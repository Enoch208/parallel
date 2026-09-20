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

export default crons;
