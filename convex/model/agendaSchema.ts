export const agendaExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessions"],
  properties: {
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "track",
          "room",
          "startsAtLocal",
          "endsAtLocal",
          "speakers",
          "titleConfidence",
          "timeConfidence",
          "roomConfidence",
        ],
        properties: {
          title: { type: "string" },
          track: { type: ["string", "null"] },
          room: { type: ["string", "null"] },
          startsAtLocal: { type: ["string", "null"] },
          endsAtLocal: { type: ["string", "null"] },
          speakers: { type: "array", items: { type: "string" } },
          titleConfidence: { type: "string", enum: ["high", "low"] },
          timeConfidence: { type: "string", enum: ["high", "low"] },
          roomConfidence: { type: "string", enum: ["high", "low"] },
        },
      },
    },
  },
} as const;

export const agendaSystemPrompt =
  "Extract conference sessions from agenda markdown. Use null when a field is not stated in the source; never guess a time, room or track. Times are local wall-clock ISO 8601 like 2026-02-22T10:00. Skip logistics entries such as registration, bag check, meals, meetups and parties. Mark a field low confidence when the source is ambiguous.";

export interface ExtractedSession {
  readonly title: string;
  readonly track: string | null;
  readonly room: string | null;
  readonly startsAtLocal: string | null;
  readonly endsAtLocal: string | null;
  readonly speakers: readonly string[];
  readonly titleConfidence: "high" | "low";
  readonly timeConfidence: "high" | "low";
  readonly roomConfidence: "high" | "low";
}

function asConfidence(value: unknown): "high" | "low" {
  return value === "high" ? "high" : "low";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asSession(value: unknown): ExtractedSession | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.title !== "string" || row.title.length === 0) {
    return null;
  }

  const speakers = Array.isArray(row.speakers)
    ? row.speakers.filter((name): name is string => typeof name === "string")
    : [];

  return {
    title: row.title,
    track: asNullableString(row.track),
    room: asNullableString(row.room),
    startsAtLocal: asNullableString(row.startsAtLocal),
    endsAtLocal: asNullableString(row.endsAtLocal),
    speakers,
    titleConfidence: asConfidence(row.titleConfidence),
    timeConfidence: asConfidence(row.timeConfidence),
    roomConfidence: asConfidence(row.roomConfidence),
  };
}

export function parseExtraction(payload: unknown): ExtractedSession[] {
  if (typeof payload !== "object" || payload === null || !("sessions" in payload)) {
    throw new Error("Extraction payload had no sessions array");
  }

  const sessions: unknown = payload.sessions;

  if (!Array.isArray(sessions)) {
    throw new Error("Extraction payload sessions was not an array");
  }

  return sessions.flatMap((row: unknown) => {
    const session = asSession(row);
    return session === null ? [] : [session];
  });
}
