import {
  BEAM_WIDTH,
  DUPLICATE_ATTENDANCE_PENALTY,
  INTEREST_BONUS,
  REPAIR_CHANGE_PENALTY,
} from "./constants";
import { productsWithSession, teamGoalCoverage, untouchedProducts } from "./coverage";
import { overlaps } from "./intervals";
import { itemAt } from "./lookup";
import type { SearchPlan } from "./searchPlan";
import { NO_SESSION } from "./searchPlan";

export interface SearchState {
  readonly memberSessions: readonly (readonly number[])[];
  readonly attendeeCounts: readonly number[];
  readonly products: readonly number[];
  readonly uniqueSessions: number;
  readonly duplicates: number;
  readonly interestHits: number;
  readonly changes: number;
  readonly score: number;
  readonly signature: string;
}

const OPTION_DIGITS = 6;
const NO_SESSION_SIGNATURE = "9".repeat(OPTION_DIGITS);

function encodeOption(option: number): string {
  if (option === NO_SESSION) return NO_SESSION_SIGNATURE;
  return String(option + 1).padStart(OPTION_DIGITS, "0");
}

function initialState(plan: SearchPlan): SearchState {
  return {
    memberSessions: plan.context.members.map(() => []),
    attendeeCounts: new Array<number>(plan.context.sessions.length).fill(0),
    products: untouchedProducts(plan.context.goals.length),
    uniqueSessions: 0,
    duplicates: 0,
    interestHits: 0,
    changes: 0,
    score: 0,
    signature: "",
  };
}

function conflictsWithTakenSessions(
  plan: SearchPlan,
  taken: readonly number[],
  sessionIndex: number,
): boolean {
  const candidate = itemAt(plan.context.sessions, sessionIndex);
  return taken.some((takenIndex) => overlaps(itemAt(plan.context.sessions, takenIndex), candidate));
}

function optionsFor(
  plan: SearchPlan,
  state: SearchState,
  windowSessions: readonly number[],
  windowIndex: number,
  memberIndex: number,
): number[] {
  const forcedSession = itemAt(itemAt(plan.forced, memberIndex), windowIndex);
  if (forcedSession !== NO_SESSION) return [forcedSession];
  const allowedRow = itemAt(plan.allowed, memberIndex);
  const taken = itemAt(state.memberSessions, memberIndex);
  const options: number[] = [];
  for (const sessionIndex of windowSessions) {
    if (!itemAt(allowedRow, sessionIndex)) continue;
    if (conflictsWithTakenSessions(plan, taken, sessionIndex)) continue;
    options.push(sessionIndex);
  }
  options.push(NO_SESSION);
  return options;
}

function changeCost(
  plan: SearchPlan,
  memberIndex: number,
  windowIndex: number,
  option: number,
): number {
  if (plan.current === null) return 0;
  return itemAt(itemAt(plan.current, memberIndex), windowIndex) === option ? 0 : 1;
}

function advance(
  plan: SearchPlan,
  state: SearchState,
  memberIndex: number,
  windowIndex: number,
  option: number,
): SearchState {
  const changes = state.changes + changeCost(plan, memberIndex, windowIndex, option);
  const signature = state.signature + encodeOption(option);
  if (option === NO_SESSION) {
    const score =
      teamGoalCoverage(plan.context, state.products) +
      INTEREST_BONUS * state.interestHits -
      DUPLICATE_ATTENDANCE_PENALTY * state.duplicates -
      REPAIR_CHANGE_PENALTY * changes;
    return { ...state, changes, signature, score };
  }
  const attendeeCounts = [...state.attendeeCounts];
  const alreadyAttending = itemAt(attendeeCounts, option);
  attendeeCounts[option] = alreadyAttending + 1;
  const firstAttendee = alreadyAttending === 0;
  const products = firstAttendee
    ? productsWithSession(plan.context, state.products, option)
    : state.products;
  const uniqueSessions = state.uniqueSessions + (firstAttendee ? 1 : 0);
  const duplicates = state.duplicates + (firstAttendee ? 0 : 1);
  const interestHits =
    state.interestHits + (itemAt(itemAt(plan.interested, memberIndex), option) ? 1 : 0);
  const memberSessions = state.memberSessions.map((sessions, index) =>
    index === memberIndex ? [...sessions, option] : sessions,
  );
  return {
    memberSessions,
    attendeeCounts,
    products,
    uniqueSessions,
    duplicates,
    interestHits,
    changes,
    signature,
    score:
      teamGoalCoverage(plan.context, products) +
      INTEREST_BONUS * interestHits -
      DUPLICATE_ATTENDANCE_PENALTY * duplicates -
      REPAIR_CHANGE_PENALTY * changes,
  };
}

function compareStates(left: SearchState, right: SearchState): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.signature === right.signature) return 0;
  return left.signature < right.signature ? -1 : 1;
}

export function runBeamSearch(plan: SearchPlan): SearchState {
  let beam: SearchState[] = [initialState(plan)];
  plan.context.windows.forEach((windowSessions, windowIndex) => {
    for (let memberIndex = 0; memberIndex < plan.context.members.length; memberIndex += 1) {
      const expanded: SearchState[] = [];
      for (const state of beam) {
        for (const option of optionsFor(plan, state, windowSessions, windowIndex, memberIndex)) {
          expanded.push(advance(plan, state, memberIndex, windowIndex, option));
        }
      }
      beam = expanded.sort(compareStates).slice(0, BEAM_WIDTH);
    }
  });
  return itemAt(beam, 0);
}
