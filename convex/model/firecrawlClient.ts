const scrapeEndpoint = "https://api.firecrawl.dev/v2/scrape";

export interface ScrapedPage {
  readonly markdown: string;
  readonly title: string | null;
  readonly statusCode: number;
}

export async function scrapeAgenda(url: string, apiKey: string): Promise<ScrapedPage> {
  if (!url.startsWith("https://")) {
    throw new Error("Only public https agenda URLs are accepted");
  }

  const response = await fetch(scrapeEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl returned ${String(response.status)}`);
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("success" in payload) ||
    payload.success !== true ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null
  ) {
    throw new Error("Firecrawl returned an unexpected payload");
  }

  const data = payload.data as {
    markdown?: unknown;
    metadata?: { title?: unknown; statusCode?: unknown };
  };
  const markdown = typeof data.markdown === "string" ? data.markdown : "";

  if (markdown.length === 0) {
    throw new Error("Firecrawl returned no markdown for that page");
  }

  return {
    markdown,
    title: typeof data.metadata?.title === "string" ? data.metadata.title : null,
    statusCode: typeof data.metadata?.statusCode === "number" ? data.metadata.statusCode : 0,
  };
}

export async function contentHash(markdown: string): Promise<string> {
  const bytes = new TextEncoder().encode(markdown);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
