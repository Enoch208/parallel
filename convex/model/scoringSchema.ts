export const scoringJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId", "goalId", "relevance", "reason"],
        properties: {
          sessionId: { type: "string" },
          goalId: { type: "string" },
          relevance: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export const scoringSystemPrompt =
  "Score how useful each conference session is for each of a team's stated goals. Return one row for every session and goal pair you are given, copying sessionId and goalId exactly as written. relevance runs from 0 to 1: 0 is no help at all, 0.3 touches the goal in passing, 0.6 is substantially about it, 0.9 is squarely on it. Most sessions are weak for most goals, so spread the scores and reserve high values. reason is at most 15 words and names what in the session earns the score. Judge only from the session text given; never invent speakers, content or outcomes.";

export interface ScoringSession {
  readonly id: string;
  readonly title: string;
  readonly track: string | null;
  readonly room: string | null;
  readonly speakers: readonly string[];
}

export interface ScoringGoal {
  readonly id: string;
  readonly label: string;
}

export interface ScoredPair {
  readonly sessionId: string;
  readonly goalId: string;
  readonly relevance: number;
  readonly reason: string;
}

const maxReasonLength = 160;

function describeSession(session: ScoringSession): string {
  const track = session.track === null ? "unstated" : session.track;
  const room = session.room === null ? "unstated" : session.room;
  const speakers = session.speakers.length === 0 ? "unstated" : session.speakers.join(", ");
  return `- sessionId ${session.id} | title: ${session.title} | track: ${track} | room: ${room} | speakers: ${speakers}`;
}

export function buildScoringPrompt(
  sessions: readonly ScoringSession[],
  goals: readonly ScoringGoal[],
): string {
  const goalLines = goals.map((goal) => `- goalId ${goal.id} | goal: ${goal.label}`).join("\n");
  const sessionLines = sessions.map(describeSession).join("\n");
  const rows = String(sessions.length * goals.length);
  return `Goals\n${goalLines}\n\nSessions\n${sessionLines}\n\nReturn exactly ${rows} rows, one for every session and goal pair above.`;
}

function clampRelevance(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(1, Math.max(0, value));
}

function asReason(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maxReasonLength) {
    return null;
  }

  return trimmed;
}

function asPair(
  value: unknown,
  sessionIds: ReadonlySet<string>,
  goalIds: ReadonlySet<string>,
): ScoredPair | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.sessionId !== "string" || !sessionIds.has(row.sessionId)) {
    return null;
  }

  if (typeof row.goalId !== "string" || !goalIds.has(row.goalId)) {
    return null;
  }

  const relevance = clampRelevance(row.relevance);
  const reason = asReason(row.reason);

  if (relevance === null || reason === null) {
    return null;
  }

  return { sessionId: row.sessionId, goalId: row.goalId, relevance, reason };
}

export function parseScores(
  payload: unknown,
  sessionIds: ReadonlySet<string>,
  goalIds: ReadonlySet<string>,
): ScoredPair[] {
  if (typeof payload !== "object" || payload === null || !("scores" in payload)) {
    throw new Error("Scoring payload had no scores array");
  }

  const rows: unknown = payload.scores;

  if (!Array.isArray(rows)) {
    throw new Error("Scoring payload scores was not an array");
  }

  const seen = new Set<string>();

  return rows.flatMap((row: unknown) => {
    const pair = asPair(row, sessionIds, goalIds);

    if (pair === null) {
      return [];
    }

    const key = `${pair.sessionId}:${pair.goalId}`;

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [pair];
  });
}

export function indexById<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item): [string, T] => [item.id, item]));
}

export function batchSessions<T>(sessions: readonly T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < sessions.length; index += size) {
    batches.push(sessions.slice(index, index + size));
  }

  return batches;
}
