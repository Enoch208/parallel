export const replyIntents = [
  "cant_attend",
  "pin",
  "yes",
  "no",
  "takeaways",
  "agenda_change",
  "question",
  "other",
] as const;

export type ReplyIntent = (typeof replyIntents)[number];

export const replyExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "sessionHint", "timeHint", "confidence", "quote"],
  properties: {
    intent: { type: "string", enum: [...replyIntents] },
    sessionHint: { type: ["string", "null"] },
    timeHint: { type: ["string", "null"] },
    confidence: { type: "number" },
    quote: { type: ["string", "null"] },
  },
} as const;

export const replySystemPrompt =
  "Classify an inbound email reply from a conference teammate. intent: cant_attend when they say they cannot attend something; pin when they insist on keeping or being given a specific session, such as asking to be pinned to it or saying they must be at it; yes when they accept covering a session; no when they decline; takeaways when they are sharing what they learned; agenda_change when forwarding an organizer notice; question when asking something; otherwise other. sessionHint is the session title or topic they refer to, or null. timeHint is the clock time they refer to such as '2pm', or null. quote MUST be copied verbatim from the email body, exactly as written, and is the single sentence you relied on. Never paraphrase the quote. confidence is 0 to 1.";

export interface ParsedReply {
  readonly intent: ReplyIntent;
  readonly sessionHint: string | null;
  readonly timeHint: string | null;
  readonly confidence: number;
  readonly quote: string | null;
  readonly quoteVerified: boolean;
}

function isIntent(value: unknown): value is ReplyIntent {
  return typeof value === "string" && (replyIntents as readonly string[]).includes(value);
}

function normalizeForQuoteCheck(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function parseReply(payload: unknown, body: string): ParsedReply {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Reply parse returned no object");
  }

  const row = payload as Record<string, unknown>;
  const intent = isIntent(row.intent) ? row.intent : "other";
  const rawConfidence = typeof row.confidence === "number" ? row.confidence : 0;
  const confidence = Math.min(1, Math.max(0, rawConfidence));
  const quote = typeof row.quote === "string" && row.quote.length > 0 ? row.quote : null;
  const normalizedQuote = quote === null ? "" : normalizeForQuoteCheck(quote);
  const substantial =
    normalizedQuote.length >= minimumQuoteCharacters &&
    normalizedQuote.split(" ").filter((word) => word.length > 0).length >= minimumQuoteWords;
  const quoteVerified =
    quote !== null && substantial && normalizeForQuoteCheck(body).includes(normalizedQuote);

  return {
    intent,
    sessionHint: typeof row.sessionHint === "string" ? row.sessionHint : null,
    timeHint: typeof row.timeHint === "string" ? row.timeHint : null,
    confidence,
    quote,
    quoteVerified,
  };
}

export const applyThreshold = 0.75;
export const minimumQuoteWords = 3;
export const minimumQuoteCharacters = 12;

export function shouldApplyAutomatically(parsed: ParsedReply): boolean {
  return parsed.confidence >= applyThreshold && parsed.quoteVerified;
}
