import type { EngineContext } from "./context";
import { itemAt } from "./lookup";

function strongestGoalIndex(context: EngineContext, sessionIndex: number): number {
  const row = itemAt(context.relevance, sessionIndex);
  let bestIndex = -1;
  let bestValue = 0;
  for (let goalIndex = 0; goalIndex < context.goals.length; goalIndex += 1) {
    const value = itemAt(context.weights, goalIndex) * itemAt(row, goalIndex);
    if (value > bestValue) {
      bestValue = value;
      bestIndex = goalIndex;
    }
  }
  return bestIndex;
}

export function describeAssignment(
  context: EngineContext,
  sessionIndex: number,
  pinned: boolean,
  interested: boolean,
): string {
  if (pinned) return "Pinned by the team, kept in every plan";
  const goalIndex = strongestGoalIndex(context, sessionIndex);
  if (goalIndex === -1) {
    return interested
      ? "Marked interested and free of conflicts in this slot"
      : "Fills an open slot without a conflict";
  }
  const goal = itemAt(context.goals, goalIndex);
  const relevance = itemAt(itemAt(context.relevance, sessionIndex), goalIndex);
  const base = `Best available lift for "${goal.label}" (relevance ${relevance.toFixed(2)})`;
  return interested ? `${base}, and marked interested` : base;
}
