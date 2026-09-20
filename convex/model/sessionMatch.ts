import type { SessionSummary } from "./types";
import { isSupportedTimezone } from "./timezone";

const meridiemPattern = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?\b/i;
const twentyFourPattern = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

export function hourFromTimeHint(hint: string): { hour: number; minute: number } | null {
  const matched = meridiemPattern.exec(hint);

  if (matched === null) {
    return twentyFourHourHint(hint);
  }

  const whole = matched.at(0);

  if (whole === undefined) {
    return null;
  }

  const hour = Number(whole.replace(/^(\d{1,2}).*$/, "$1"));
  const minuteText = whole.replace(/^\d{1,2}:(\d{2}).*$/, "$1");
  const minute = /^\d{2}$/.test(minuteText) ? Number(minuteText) : 0;
  const isAfternoon = /p/i.test(whole);

  if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
    return null;
  }

  const normalizedHour = isAfternoon ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;

  return { hour: normalizedHour, minute };
}

function twentyFourHourHint(hint: string): { hour: number; minute: number } | null {
  const matched = twentyFourPattern.exec(hint);

  if (matched === null) {
    return null;
  }

  const whole = matched.at(0);

  if (whole === undefined) {
    return null;
  }

  const hour = Number(whole.replace(/^(\d{1,2}):.*$/, "$1"));
  const minute = Number(whole.replace(/^\d{1,2}:(\d{2}).*$/, "$1"));

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return { hour, minute };
}

function localHourMinute(epoch: number, timezone: string): { hour: number; minute: number } {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epoch));

  return { hour: Number(text.slice(0, 2)), minute: Number(text.slice(3, 5)) };
}

function onlyMatch(matches: readonly SessionSummary[]): SessionSummary | null {
  let found: SessionSummary | null = null;
  let seen = 0;

  for (const match of matches) {
    found = match;
    seen += 1;

    if (seen > 1) {
      return null;
    }
  }

  return seen === 1 ? found : null;
}

export function matchSessionByTime(
  sessions: readonly SessionSummary[],
  timeHint: string,
  timezone: string,
): SessionSummary | null {
  const target = hourFromTimeHint(timeHint);

  if (target === null || !isSupportedTimezone(timezone)) {
    return null;
  }

  return onlyMatch(
    sessions.filter((session) => {
      const local = localHourMinute(session.startsAt, timezone);
      return local.hour === target.hour && Math.abs(local.minute - target.minute) <= 30;
    }),
  );
}

export function matchSessionByTitle(
  sessions: readonly SessionSummary[],
  hint: string,
): SessionSummary | null {
  const needle = hint.trim().toLowerCase();

  if (needle.length < 4) {
    return null;
  }

  return onlyMatch(sessions.filter((session) => session.title.toLowerCase().includes(needle)));
}
