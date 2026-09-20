import { isSupportedTimezone } from "./timezone";

const fallbackTimeZone = "UTC";
const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function readZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: ZonedParts = { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 };

  for (const part of formatter.formatToParts(date)) {
    const value = Number(part.value);

    if (part.type === "year") parts.year = value;
    if (part.type === "month") parts.month = value;
    if (part.type === "day") parts.day = value;
    if (part.type === "hour") parts.hour = value === 24 ? 0 : value;
    if (part.type === "minute") parts.minute = value;
    if (part.type === "second") parts.second = value;
  }

  return parts;
}

function zonedPartsToUtc(date: Date, timeZone: string): number {
  const parts = readZonedParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function zonedTimeToEpoch(local: string, timeZone: string): number | null {
  const match = localPattern.exec(local);

  if (match === null || !isSupportedTimezone(timeZone)) {
    return null;
  }

  const naive = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );

  const firstOffset = zonedPartsToUtc(new Date(naive), timeZone) - naive;
  const adjusted = naive - firstOffset;
  const secondOffset = zonedPartsToUtc(new Date(adjusted), timeZone) - adjusted;

  return naive - secondOffset;
}

export function startOfLocalDay(now: number, timeZone: string): number {
  const usable = isSupportedTimezone(timeZone) ? timeZone : fallbackTimeZone;
  const parts = readZonedParts(new Date(now), usable);
  const midnightGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offset = zonedPartsToUtc(new Date(midnightGuess), usable) - midnightGuess;

  return midnightGuess - offset;
}
