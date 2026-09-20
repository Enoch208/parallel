import type { GoalSummary, RelevanceScore, SessionSummary } from "../../convex/model/types";
import type {
  AvailabilityBlockSummary,
  MemberPreferenceSummary,
  MemberStance,
  OptimizerInput,
} from "../../convex/engine/types";
import { block, DAY_START, goal, HOUR, member, preference, score, session } from "./fixtures";

export interface InstanceShape {
  readonly maxMembers: number;
  readonly maxWindows: number;
  readonly maxTracks: number;
  readonly maxGoals: number;
  readonly longSessionChance: number;
  readonly blockChance: number;
  readonly pinChance: number;
  readonly interestChance: number;
  readonly avoidChance: number;
}

export const smallShape: InstanceShape = {
  maxMembers: 2,
  maxWindows: 3,
  maxTracks: 2,
  maxGoals: 2,
  longSessionChance: 0.25,
  blockChance: 0.3,
  pinChance: 0.25,
  interestChance: 0.4,
  avoidChance: 0.2,
};

export const mediumShape: InstanceShape = {
  maxMembers: 4,
  maxWindows: 5,
  maxTracks: 4,
  maxGoals: 4,
  longSessionChance: 0.2,
  blockChance: 0.4,
  pinChance: 0.3,
  interestChance: 0.5,
  avoidChance: 0.25,
};

export const largeShape: InstanceShape = {
  maxMembers: 6,
  maxWindows: 8,
  maxTracks: 5,
  maxGoals: 5,
  longSessionChance: 0.2,
  blockChance: 0.5,
  pinChance: 0.3,
  interestChance: 0.5,
  avoidChance: 0.25,
};

export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function intBetween(random: Random, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

function pickIndex(random: Random, count: number): number {
  return Math.min(count - 1, Math.floor(random() * count));
}

function buildSessions(
  random: Random,
  shape: InstanceShape,
  windowCount: number,
): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const trackCount = intBetween(random, 1, shape.maxTracks);
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      const long = random() < shape.longSessionChance;
      sessions.push(
        session(
          `w${String(windowIndex)}t${String(trackIndex)}`,
          `Window ${String(windowIndex)} track ${String(trackIndex)}`,
          windowIndex * 2,
          long ? 3 : 1,
          `T${String(trackIndex)}`,
        ),
      );
    }
  }
  return sessions;
}

function buildGoals(random: Random, goalCount: number): GoalSummary[] {
  const goals: GoalSummary[] = [];
  for (let goalIndex = 0; goalIndex < goalCount; goalIndex += 1) {
    goals.push(
      goal(`g${String(goalIndex)}`, `Goal ${String(goalIndex)}`, intBetween(random, 1, 5)),
    );
  }
  return goals;
}

function buildScores(
  random: Random,
  sessions: readonly SessionSummary[],
  goals: readonly GoalSummary[],
): RelevanceScore[] {
  const scores: RelevanceScore[] = [];
  for (const entry of sessions) {
    for (const target of goals) {
      const relevance = random() < 0.25 ? 0 : intBetween(random, 1, 9) / 10;
      if (relevance === 0) continue;
      scores.push(score(entry.id, target.id, relevance));
    }
  }
  return scores;
}

function buildBlocks(
  random: Random,
  shape: InstanceShape,
  memberIds: readonly string[],
  windowCount: number,
): AvailabilityBlockSummary[] {
  const blocks: AvailabilityBlockSummary[] = [];
  for (const membershipId of memberIds) {
    if (random() >= shape.blockChance) continue;
    const windowIndex = pickIndex(random, windowCount);
    blocks.push(
      block(membershipId, windowIndex * 2 - 0.25, random() < 0.3 ? 2.5 : 1, "Customer call"),
    );
  }
  return blocks;
}

function buildPreferences(
  random: Random,
  shape: InstanceShape,
  memberIds: readonly string[],
  sessions: readonly SessionSummary[],
): MemberPreferenceSummary[] {
  const preferences: MemberPreferenceSummary[] = [];
  const taken = new Set<string>();
  const add = (membershipId: string, stance: MemberStance): void => {
    const chosen = sessions[pickIndex(random, sessions.length)];
    if (chosen === undefined) return;
    const key = `${membershipId}\u0000${chosen.id}`;
    if (taken.has(key)) return;
    taken.add(key);
    preferences.push(preference(membershipId, chosen.id, stance));
  };
  for (const membershipId of memberIds) {
    if (random() < shape.pinChance) add(membershipId, "pinned");
    if (random() < shape.interestChance) add(membershipId, "interested");
    if (random() < shape.avoidChance) add(membershipId, "avoid");
  }
  return preferences;
}

export function randomInstance(seed: number, shape: InstanceShape): OptimizerInput {
  const random = createRandom(seed);
  const memberCount = intBetween(random, 1, shape.maxMembers);
  const windowCount = intBetween(random, 1, shape.maxWindows);
  const members = Array.from({ length: memberCount }, (_unused, index) =>
    member(`m${String(index)}`, `Teammate ${String(index)}`),
  );
  const memberIds = members.map((teammate) => teammate.id);
  const sessions = buildSessions(random, shape, windowCount);
  const goals = buildGoals(random, intBetween(random, 1, shape.maxGoals));
  return {
    sessions,
    goals,
    members,
    scores: buildScores(random, sessions, goals),
    preferences: buildPreferences(random, shape, memberIds, sessions),
    blocks: buildBlocks(random, shape, memberIds, windowCount),
  };
}

export function withExtraBlock(input: OptimizerInput, seed: number): OptimizerInput {
  const random = createRandom(seed + 7919);
  const teammate = input.members[pickIndex(random, input.members.length)];
  if (teammate === undefined) return input;
  const chosen = input.sessions[pickIndex(random, input.sessions.length)];
  if (chosen === undefined) return input;
  const startHour = (chosen.startsAt - DAY_START) / HOUR;
  return {
    ...input,
    blocks: [...input.blocks, block(teammate.id, startHour, 1, "New conflict")],
  };
}
