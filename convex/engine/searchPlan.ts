import type { AssignmentSummary } from "../model/types";
import type { EngineContext } from "./context";
import { buildEngineContext } from "./context";
import { overlaps } from "./intervals";
import { itemAt, valueFor } from "./lookup";
import type { OptimizerInput } from "./types";

export const NO_SESSION = -1;

export interface SearchPlan {
  readonly context: EngineContext;
  readonly allowed: readonly (readonly boolean[])[];
  readonly interested: readonly (readonly boolean[])[];
  readonly forced: readonly (readonly number[])[];
  readonly current: readonly (readonly number[])[] | null;
}

function applyBlocks(context: EngineContext, input: OptimizerInput, allowed: boolean[][]): void {
  for (const block of input.blocks) {
    const memberIndex = context.memberIndexById.get(block.membershipId);
    if (memberIndex === undefined) continue;
    const row = itemAt(allowed, memberIndex);
    context.sessions.forEach((session, sessionIndex) => {
      if (overlaps(session, block)) row[sessionIndex] = false;
    });
  }
}

function applyPin(
  context: EngineContext,
  allowed: boolean[][],
  forced: number[][],
  memberIndex: number,
  sessionIndex: number,
): void {
  const row = itemAt(allowed, memberIndex);
  const pinnedSession = itemAt(context.sessions, sessionIndex);
  context.sessions.forEach((session, otherIndex) => {
    if (otherIndex !== sessionIndex && overlaps(session, pinnedSession)) row[otherIndex] = false;
  });
  row[sessionIndex] = true;
  const windowIndex = valueFor(context.windowOfSession, sessionIndex, "time window");
  itemAt(forced, memberIndex)[windowIndex] = sessionIndex;
}

function currentChoices(context: EngineContext, current: readonly AssignmentSummary[]): number[][] {
  const choices = context.members.map(() =>
    new Array<number>(context.windows.length).fill(NO_SESSION),
  );
  for (const assignment of current) {
    const memberIndex = context.memberIndexById.get(assignment.membershipId);
    const sessionIndex = context.sessionIndexById.get(assignment.sessionId);
    if (memberIndex === undefined || sessionIndex === undefined) continue;
    const windowIndex = valueFor(context.windowOfSession, sessionIndex, "time window");
    itemAt(choices, memberIndex)[windowIndex] = sessionIndex;
  }
  return choices;
}

export function buildSearchPlan(
  input: OptimizerInput,
  current: readonly AssignmentSummary[] | null,
): SearchPlan {
  const context = buildEngineContext(input);
  const allowed = context.members.map(() => new Array<boolean>(context.sessions.length).fill(true));
  const interested = context.members.map(() =>
    new Array<boolean>(context.sessions.length).fill(false),
  );
  const forced = context.members.map(() =>
    new Array<number>(context.windows.length).fill(NO_SESSION),
  );
  applyBlocks(context, input, allowed);
  const pins: { memberIndex: number; sessionIndex: number }[] = [];
  for (const preference of input.preferences) {
    const memberIndex = context.memberIndexById.get(preference.membershipId);
    const sessionIndex = context.sessionIndexById.get(preference.sessionId);
    if (memberIndex === undefined || sessionIndex === undefined) continue;
    if (preference.stance === "interested") itemAt(interested, memberIndex)[sessionIndex] = true;
    if (preference.stance === "avoid") itemAt(allowed, memberIndex)[sessionIndex] = false;
    if (preference.stance === "pinned") pins.push({ memberIndex, sessionIndex });
  }
  for (const pin of pins) applyPin(context, allowed, forced, pin.memberIndex, pin.sessionIndex);
  return {
    context,
    allowed,
    interested,
    forced,
    current: current === null ? null : currentChoices(context, current),
  };
}
