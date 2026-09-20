const exampleTimezone = "America/Los_Angeles";
const maxReportedLength = 80;

function resolveThroughIntl(candidate: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions().timeZone;
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

function differsOnlyByCase(candidate: string, resolved: string): boolean {
  return candidate !== resolved && candidate.toLowerCase() === resolved.toLowerCase();
}

function quoteForMessage(candidate: string): string {
  const shown =
    candidate.length > maxReportedLength
      ? `${candidate.slice(0, maxReportedLength)}...`
      : candidate;

  return JSON.stringify(shown);
}

export function isSupportedTimezone(candidate: string): boolean {
  return resolveThroughIntl(candidate) !== null;
}

export function assertConferenceTimezone(candidate: string): void {
  if (candidate.trim().length === 0) {
    throw new Error(`A conference timezone is required. Use an IANA name like ${exampleTimezone}.`);
  }

  const resolved = resolveThroughIntl(candidate);

  if (resolved === null) {
    throw new Error(
      `Timezone ${quoteForMessage(candidate)} is not a timezone this system recognizes. Use an IANA name like ${exampleTimezone}.`,
    );
  }

  if (differsOnlyByCase(candidate, resolved)) {
    throw new Error(
      `Timezone ${quoteForMessage(candidate)} is not spelled the way IANA spells it. Use "${resolved}" instead.`,
    );
  }
}

export function displayTimezone(candidate: string): string {
  return isSupportedTimezone(candidate) ? candidate : "UTC";
}
