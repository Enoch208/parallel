function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstUrl(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string" && value.startsWith("https://")) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstUrl(entry, depth + 1);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of ["url", "sourceURL", "pageUrl"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.startsWith("https://")) {
      return candidate;
    }
  }

  for (const nested of Object.values(value)) {
    const found = firstUrl(nested, depth + 1);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

export function readMonitoredUrl(payload: unknown): string | null {
  return firstUrl(payload);
}
