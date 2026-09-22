const storageKey = "parallel.visitor";

let pageKey: string | null = null;

function pageLifetimeKey(): string {
  pageKey ??= crypto.randomUUID();
  return pageKey;
}

export function visitorKey(): string {
  try {
    const stored = window.localStorage.getItem(storageKey);

    if (stored !== null && stored.length > 0) {
      return stored;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return pageLifetimeKey();
  }
}
