import type { CoverageSummary } from "./types";

export const briefSourceKinds = ["note", "session"] as const;
export type BriefSourceKind = (typeof briefSourceKinds)[number];

export interface BriefClaim {
  readonly statement: string;
  readonly sourceKind: BriefSourceKind;
  readonly sourceId: string;
}

export interface BriefSection {
  readonly goalId: string;
  readonly goalLabel: string;
  readonly claims: readonly BriefClaim[];
}

export interface BriefNoteInput {
  readonly id: string;
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly authorName: string;
  readonly body: string;
}

export interface BriefGoalInput {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
}

export interface BriefSessionInput {
  readonly id: string;
  readonly title: string;
  readonly track: string | null;
  readonly speakers: readonly string[];
}

export const briefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sections"],
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["goalId", "goalLabel", "claims"],
        properties: {
          goalId: { type: "string" },
          goalLabel: { type: "string" },
          claims: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["statement", "sourceKind", "sourceId"],
              properties: {
                statement: { type: "string" },
                sourceKind: { type: "string", enum: [...briefSourceKinds] },
                sourceId: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const briefSystemPrompt =
  "You write a post-conference brief for a team from material they gathered themselves. Use ONLY the goals, teammate notes and session entries supplied in the user message. You must not add a single outside fact: no statistic, vendor, product, speaker claim, market context, definition or recommendation that is not already written in the supplied material, and nothing you know about this event, these companies or these speakers from anywhere else. Prefer what a teammate wrote; use a session entry only to name a session the notes already refer to. Group the brief under the goal ids supplied, one section per goal that the material actually supports, and leave a goal out entirely when nothing supports it. Every claim carries sourceKind and sourceId copied character for character from the supplied material: sourceKind 'note' with a note id for anything a teammate wrote, sourceKind 'session' with a session id for anything taken from a session entry. Never invent, shorten or merge an id. A claim you cannot attribute to one supplied id must not be written at all.";

function noteLines(notes: readonly BriefNoteInput[]): string {
  return notes
    .map(
      (note) =>
        `note id=${note.id} session=${note.sessionId} sessionTitle=${note.sessionTitle} author=${note.authorName}\n${note.body}`,
    )
    .join("\n\n");
}

function sessionLines(sessions: readonly BriefSessionInput[]): string {
  return sessions
    .map(
      (session) =>
        `session id=${session.id} title=${session.title} track=${session.track ?? "unstated"} speakers=${session.speakers.length === 0 ? "unstated" : session.speakers.join(", ")}`,
    )
    .join("\n");
}

export function buildBriefPrompt(
  eventName: string,
  goals: readonly BriefGoalInput[],
  notes: readonly BriefNoteInput[],
  sessions: readonly BriefSessionInput[],
): string {
  const goalText = goals
    .map((goal) => `goal id=${goal.id} weight=${String(goal.weight)} label=${goal.label}`)
    .join("\n");

  return `Event: ${eventName}\n\nGOALS\n${goalText}\n\nTEAMMATE NOTES\n${noteLines(notes)}\n\nSESSION ENTRIES FROM THE AGENDA\n${sessionLines(sessions)}`;
}

function asClaim(value: unknown): BriefClaim | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const kind = row.sourceKind;

  if (typeof row.statement !== "string" || row.statement.trim().length === 0) {
    return null;
  }

  if (typeof row.sourceId !== "string" || row.sourceId.length === 0) {
    return null;
  }

  if (kind !== "note" && kind !== "session") {
    return null;
  }

  return { statement: row.statement.trim(), sourceKind: kind, sourceId: row.sourceId };
}

export interface ParsedBrief {
  readonly sections: readonly BriefSection[];
  readonly malformedSections: number;
  readonly malformedClaims: number;
}

export function parseBrief(payload: unknown): ParsedBrief {
  if (typeof payload !== "object" || payload === null || !("sections" in payload)) {
    throw new Error("Brief payload had no sections array");
  }

  const raw: unknown = payload.sections;

  if (!Array.isArray(raw)) {
    throw new Error("Brief payload sections was not an array");
  }

  const sections: BriefSection[] = [];
  let malformedSections = 0;
  let malformedClaims = 0;

  for (const entry of raw as unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      malformedSections += 1;
      continue;
    }

    const row = entry as Record<string, unknown>;

    if (typeof row.goalId !== "string" || typeof row.goalLabel !== "string") {
      malformedSections += 1;
      continue;
    }

    const rawClaims: unknown = row.claims;

    if (!Array.isArray(rawClaims)) {
      malformedSections += 1;
      continue;
    }

    const claims: BriefClaim[] = [];

    for (const candidate of rawClaims as unknown[]) {
      const claim = asClaim(candidate);

      if (claim === null) {
        malformedClaims += 1;
        continue;
      }

      claims.push(claim);
    }

    sections.push({ goalId: row.goalId, goalLabel: row.goalLabel, claims });
  }

  return { sections, malformedSections, malformedClaims };
}

export interface KnownSources {
  readonly goalIds: ReadonlySet<string>;
  readonly noteIds: ReadonlySet<string>;
  readonly sessionIds: ReadonlySet<string>;
}

export interface VerifiedBrief {
  readonly sections: readonly BriefSection[];
  readonly unknownGoalSections: number;
  readonly unknownSourceClaims: number;
  readonly emptiedSections: number;
}

export function verifyBriefSources(
  sections: readonly BriefSection[],
  known: KnownSources,
): VerifiedBrief {
  const kept: BriefSection[] = [];
  let unknownGoalSections = 0;
  let unknownSourceClaims = 0;
  let emptiedSections = 0;

  for (const section of sections) {
    if (!known.goalIds.has(section.goalId)) {
      unknownGoalSections += 1;
      continue;
    }

    const claims = section.claims.filter((claim) =>
      claim.sourceKind === "note"
        ? known.noteIds.has(claim.sourceId)
        : known.sessionIds.has(claim.sourceId),
    );

    unknownSourceClaims += section.claims.length - claims.length;

    if (claims.length === 0) {
      emptiedSections += 1;
      continue;
    }

    kept.push({ goalId: section.goalId, goalLabel: section.goalLabel, claims });
  }

  return { sections: kept, unknownGoalSections, unknownSourceClaims, emptiedSections };
}

export function renderBriefBody(
  eventName: string,
  sections: readonly BriefSection[],
  sourceLabels: ReadonlyMap<string, string>,
): string {
  const heading = `# ${eventName}: what the team learned`;

  if (sections.length === 0) {
    return `${heading}\n\nNo takeaway in the team's notes could be attributed to a goal, so this brief has no claims.`;
  }

  const blocks = sections.map((section) => {
    const lines = section.claims.map((claim) => {
      const label = sourceLabels.get(claim.sourceId) ?? claim.sourceId;
      return `- ${claim.statement}\n  Source: ${label} [${claim.sourceKind}:${claim.sourceId}]`;
    });

    return `## ${section.goalLabel}\n${lines.join("\n")}`;
  });

  return `${heading}\n\n${blocks.join("\n\n")}`;
}

export const tripCostEstimateLabel =
  "Entered by the team lead; Parallel never prices a trip itself";

export interface TripSummaryFacts {
  readonly eventName: string;
  readonly attendees: number;
  readonly tripCostEstimate: number | null;
  readonly sessionsAvailable: number;
  readonly before: CoverageSummary;
  readonly after: CoverageSummary;
  readonly noteSessionIds: readonly string[];
}

export interface TripSummary {
  readonly eventName: string;
  readonly attendees: number;
  readonly tripCostEstimate: number | null;
  readonly tripCostEstimateLabel: string;
  readonly costPerSessionCovered: number | null;
  readonly sessionsAvailable: number;
  readonly sessionsUniquelyCovered: number;
  readonly duplicateAttendances: number;
  readonly coverageBefore: number;
  readonly coverageAfter: number;
  readonly coverageGain: number;
  readonly goalsTotal: number;
  readonly goalsRepresented: number;
  readonly takeawaysCaptured: number;
  readonly sessionsWithTakeaways: number;
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildTripSummary(facts: TripSummaryFacts): TripSummary {
  const coverageBefore = toOneDecimal(facts.before.teamGoalCoverage);
  const coverageAfter = toOneDecimal(facts.after.teamGoalCoverage);
  const sessionsUniquelyCovered = facts.after.uniqueSessions;
  const costPerSessionCovered =
    facts.tripCostEstimate === null || sessionsUniquelyCovered === 0
      ? null
      : Math.round(facts.tripCostEstimate / sessionsUniquelyCovered);

  return {
    eventName: facts.eventName,
    attendees: facts.attendees,
    tripCostEstimate: facts.tripCostEstimate,
    tripCostEstimateLabel,
    costPerSessionCovered,
    sessionsAvailable: facts.sessionsAvailable,
    sessionsUniquelyCovered,
    duplicateAttendances: facts.after.duplicateAttendances,
    coverageBefore,
    coverageAfter,
    coverageGain: toOneDecimal(coverageAfter - coverageBefore),
    goalsTotal: facts.after.perGoal.length,
    goalsRepresented: facts.after.perGoal.filter((goal) => goal.coverage > 0).length,
    takeawaysCaptured: facts.noteSessionIds.length,
    sessionsWithTakeaways: new Set(facts.noteSessionIds).size,
  };
}
