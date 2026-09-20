import { displayTimezone } from "./timezone";

const inboxesEndpoint = "https://api.agentmail.to/v0/inboxes";

export interface SentMessage {
  readonly messageId: string;
  readonly threadId: string;
}

export interface SendEmailInput {
  readonly inboxId: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly apiKey: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SentMessage> {
  if (input.to.length === 0) {
    throw new Error("An outbound email needs at least one recipient");
  }

  const response = await fetch(
    `${inboxesEndpoint}/${encodeURIComponent(input.inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [...input.to],
        subject: input.subject,
        text: input.text,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AgentMail returned ${String(response.status)}: ${detail.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();

  if (typeof payload !== "object" || payload === null) {
    throw new Error("AgentMail returned an unexpected send payload");
  }

  const body = payload as { message_id?: unknown; thread_id?: unknown };

  if (typeof body.message_id !== "string" || body.message_id.length === 0) {
    throw new Error("AgentMail returned no message_id");
  }

  if (typeof body.thread_id !== "string" || body.thread_id.length === 0) {
    throw new Error("AgentMail returned no thread_id");
  }

  return { messageId: body.message_id, threadId: body.thread_id };
}

export interface PlanEmailSession {
  readonly title: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly room: string | null;
  readonly reason: string;
}

export function buildIdempotencyKey(
  kind: string,
  membershipId: string,
  planRevision: number,
  scope = "",
): string {
  const parts = [kind, membershipId, String(planRevision)];
  return (scope.length === 0 ? parts : [...parts, scope]).join(":");
}

export function subjectWithToken(headline: string, token: string): string {
  return `${headline} [PL-${token}]`;
}

export function slotLabel(startsAt: number, endsAt: number, timezone: string): string {
  const zone = displayTimezone(timezone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const field = (date: Date, type: Intl.DateTimeFormatPartTypes): string =>
    formatter.formatToParts(date).find((part) => part.type === type)?.value ?? "";

  const clock = (date: Date): string => `${field(date, "hour")}:${field(date, "minute")}`;
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const label = `${field(start, "weekday")} ${field(start, "day")} ${field(start, "month")} ${clock(start)}-${clock(end)}`;
  return zone === timezone ? label : `${label} UTC`;
}

function sessionBlock(
  session: PlanEmailSession,
  index: number,
  timezone: string,
  room: string | null,
): string {
  const where = room === null ? "" : ` · ${room}`;
  const slot = slotLabel(session.startsAt, session.endsAt, timezone);
  return `${String(index + 1)}. ${slot}${where}\n   ${session.title}\n   Why: ${session.reason}`;
}

export interface PlanEmailInput {
  readonly displayName: string;
  readonly conferenceName: string;
  readonly timezone: string;
  readonly sessions: readonly PlanEmailSession[];
}

export function planEmailBody(input: PlanEmailInput): string {
  const blocks = input.sessions.map((session, index) =>
    sessionBlock(session, index, input.timezone, session.room),
  );

  return [
    `Hi ${input.displayName},`,
    "",
    `Here is your plan for ${input.conferenceName}. Times are local to the venue.`,
    "",
    blocks.join("\n\n"),
    "",
    'If something does not work, reply to this email in your own words — "I cannot make the 14:00" is enough and the plan updates itself.',
  ].join("\n");
}

export interface CoverEmailInput {
  readonly displayName: string;
  readonly droppedBy: string;
  readonly sessionTitle: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly room: string | null;
  readonly timezone: string;
  readonly reasons: readonly string[];
}

export function coverEmailBody(input: CoverEmailInput): string {
  const where = input.room === null ? "" : ` · ${input.room}`;
  const slot = slotLabel(input.startsAt, input.endsAt, input.timezone);

  return [
    `Hi ${input.displayName},`,
    "",
    `${input.droppedBy} can no longer attend "${input.sessionTitle}" (${slot}${where}).`,
    "",
    "You are the best placed person on the team to cover it:",
    ...input.reasons.map((reason) => `- ${reason}`),
    "",
    "Reply YES to take it and the board moves you. Reply NO, or ignore this, and nothing changes.",
  ].join("\n");
}
