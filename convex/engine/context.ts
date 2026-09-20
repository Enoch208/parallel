import type { GoalSummary, SessionSummary } from "../model/types";
import {
  groupSessionIndicesByWindow,
  sortedSessions,
  windowIndexBySessionIndex,
} from "./intervals";
import { itemAt } from "./lookup";
import type { CoverageInput, MemberSummary } from "./types";

export interface EngineContext {
  readonly sessions: readonly SessionSummary[];
  readonly goals: readonly GoalSummary[];
  readonly members: readonly MemberSummary[];
  readonly sessionIndexById: ReadonlyMap<string, number>;
  readonly goalIndexById: ReadonlyMap<string, number>;
  readonly memberIndexById: ReadonlyMap<string, number>;
  readonly relevance: readonly (readonly number[])[];
  readonly weights: readonly number[];
  readonly weightTotal: number;
  readonly windows: readonly (readonly number[])[];
  readonly windowOfSession: ReadonlyMap<number, number>;
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}

function indexById(items: readonly { readonly id: string }[]): Map<string, number> {
  const lookup = new Map<string, number>();
  items.forEach((item, index) => lookup.set(item.id, index));
  return lookup;
}

export function buildEngineContext(input: CoverageInput): EngineContext {
  const sessions = sortedSessions(input.sessions);
  const goals = [...input.goals].sort(compareById);
  const members = [...input.members].sort(compareById);
  const sessionIndexById = indexById(sessions);
  const goalIndexById = indexById(goals);
  const memberIndexById = indexById(members);
  const relevance = sessions.map(() => new Array<number>(goals.length).fill(0));
  for (const score of input.scores) {
    const sessionIndex = sessionIndexById.get(score.sessionId);
    const goalIndex = goalIndexById.get(score.goalId);
    if (sessionIndex === undefined || goalIndex === undefined) continue;
    itemAt(relevance, sessionIndex)[goalIndex] = clampUnitInterval(score.relevance);
  }
  const weights = goals.map((goal) =>
    Number.isFinite(goal.weight) ? Math.max(0, goal.weight) : 0,
  );
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  const windows = groupSessionIndicesByWindow(sessions);
  return {
    sessions,
    goals,
    members,
    sessionIndexById,
    goalIndexById,
    memberIndexById,
    relevance,
    weights,
    weightTotal,
    windows,
    windowOfSession: windowIndexBySessionIndex(windows),
  };
}
