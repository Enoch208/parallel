import type { AssignmentSummary, SessionSummary } from "../../convex/model/types";
import type { OptimizerInput } from "../../convex/engine/types";
import { goal, member, preference, scoreRow, session } from "./fixtures";

const goalIds = ["g-agents", "g-evals", "g-infra", "g-hiring"] as const;

const goals = [
  goal("g-agents", "Agent architectures in production", 5),
  goal("g-evals", "Evaluation and reliability", 4),
  goal("g-infra", "Inference cost and infrastructure", 3),
  goal("g-hiring", "Hiring and team signals", 2),
];

const sessions: SessionSummary[] = [
  session("s01", "Scaling retrieval for messy corpora", 0, 1, "Data"),
  session("s02", "Keynote: agents that actually ship", 0, 1, "Main"),
  session("s03", "Hiring for an AI-native team", 0, 1, "People"),
  session("s04", "Designing tool schemas that models obey", 1.5, 1, "Build"),
  session("s05", "The eval gap: why demos lie", 1.5, 1, "Main"),
  session("s06", "GPU economics for small teams", 1.5, 1, "Infra"),
  session("s07", "Multi-agent orchestration patterns", 4, 1, "Build"),
  session("s08", "Fireside: what broke in production", 4, 1, "Main"),
  session("s09", "Caching and batching at the edge", 4, 1, "Infra"),
  session("s10", "Offline evals to online guardrails", 5.5, 1, "Eval"),
  session("s11", "Prompt regression suites in CI", 5.5, 1, "Eval"),
  session("s12", "Interviewing engineers who use agents", 5.5, 1, "People"),
  session("s13", "Cost dashboards teams actually read", 7, 1, "Infra"),
  session("s14", "Career paths for applied AI", 7, 1, "People"),
];

const relevances: Record<string, readonly number[]> = {
  s01: [0.35, 0.2, 0.45, 0.05],
  s02: [0.85, 0.3, 0.15, 0.25],
  s03: [0.05, 0.05, 0.0, 0.9],
  s04: [0.7, 0.25, 0.1, 0.0],
  s05: [0.3, 0.9, 0.05, 0.1],
  s06: [0.1, 0.05, 0.85, 0.05],
  s07: [0.8, 0.2, 0.2, 0.0],
  s08: [0.55, 0.6, 0.4, 0.3],
  s09: [0.05, 0.1, 0.8, 0.0],
  s10: [0.25, 0.85, 0.1, 0.05],
  s11: [0.2, 0.75, 0.05, 0.05],
  s12: [0.1, 0.1, 0.0, 0.85],
  s13: [0.05, 0.15, 0.75, 0.1],
  s14: [0.1, 0.05, 0.05, 0.7],
};

const members = [
  member("m-ada", "Ada"),
  member("m-brian", "Brian"),
  member("m-cleo", "Cleo"),
  member("m-dev", "Dev"),
];

const famousSessions = ["s02", "s05", "s08"];

const preferences = [
  ...members.flatMap((teammate) =>
    famousSessions.map((sessionId) => preference(teammate.id, sessionId, "interested")),
  ),
  preference("m-ada", "s07", "interested"),
  preference("m-dev", "s12", "interested"),
];

export const canonicalScenario: OptimizerInput = {
  sessions,
  goals,
  members,
  scores: sessions.flatMap((entry) => scoreRow(entry.id, goalIds, relevances[entry.id] ?? [])),
  preferences,
  blocks: [],
};

export function everyoneChasesTheFamousSessions(input: OptimizerInput): AssignmentSummary[] {
  const interestedSessionIds = new Map<string, Set<string>>();
  for (const entry of input.preferences) {
    if (entry.stance !== "interested") continue;
    const existing = interestedSessionIds.get(entry.membershipId);
    if (existing === undefined) {
      interestedSessionIds.set(entry.membershipId, new Set([entry.sessionId]));
      continue;
    }
    existing.add(entry.sessionId);
  }
  const startTimes = [...new Set(input.sessions.map((entry) => entry.startsAt))].sort(
    (left, right) => left - right,
  );
  const assignments: AssignmentSummary[] = [];
  for (const teammate of input.members) {
    const wanted = interestedSessionIds.get(teammate.id) ?? new Set<string>();
    for (const startsAt of startTimes) {
      const pick = input.sessions
        .filter((entry) => entry.startsAt === startsAt && wanted.has(entry.id))
        .sort((left, right) => (left.id < right.id ? -1 : 1))[0];
      if (pick === undefined) continue;
      assignments.push({
        sessionId: pick.id,
        membershipId: teammate.id,
        pinned: false,
        reason: "Chosen by the teammate before any planning",
      });
    }
  }
  return assignments;
}
