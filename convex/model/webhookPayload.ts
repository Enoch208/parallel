export interface InboundMessage {
  readonly messageId: string | null;
  readonly threadId: string | null;
  readonly from: string;
  readonly subject: string;
  readonly body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function looksLikeMessage(value: Record<string, unknown>): boolean {
  return "message_id" in value || ("subject" in value && "from" in value);
}

export function findMessage(payload: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || !isRecord(payload)) {
    return null;
  }

  if (looksLikeMessage(payload)) {
    return payload;
  }

  for (const value of Object.values(payload)) {
    const nested = findMessage(value, depth + 1);

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

export function readInboundMessage(payload: unknown): InboundMessage | null {
  const message = findMessage(payload);

  if (message === null) {
    return null;
  }

  return {
    messageId: asText(message.message_id),
    threadId: asText(message.thread_id),
    from: asText(message.from) ?? "unknown",
    subject: asText(message.subject) ?? "",
    body: asText(message.extracted_text) ?? asText(message.text) ?? asText(message.preview) ?? "",
  };
}

export function readEventId(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  return asText(payload.event_id) ?? asText(payload.id) ?? fallback;
}

export function readEventType(payload: unknown): string {
  if (!isRecord(payload)) {
    return "unknown";
  }

  return asText(payload.event_type) ?? asText(payload.type) ?? "unknown";
}
