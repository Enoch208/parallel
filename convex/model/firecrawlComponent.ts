import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { ConvexError } from "convex/values";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import type { ComponentApi } from "@firecrawl/firecrawl-convex/_generated/component";

export { contentHash } from "./firecrawlClient";

export interface ScrapedPage {
  readonly markdown: string;
  readonly title: string | null;
  readonly statusCode: number;
}

export type ScrapeActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

export function assertAgendaUrl(url: string): void {
  if (!url.startsWith("https://")) {
    throw new Error("Only public https agenda URLs are accepted");
  }
}

export function readScrapedPage(document: unknown): ScrapedPage {
  if (typeof document !== "object" || document === null) {
    throw new Error("Firecrawl returned an unexpected payload");
  }

  const markdown =
    "markdown" in document && typeof document.markdown === "string" ? document.markdown : "";

  if (markdown.length === 0) {
    throw new Error("Firecrawl returned no markdown for that page");
  }

  if (
    !("metadata" in document) ||
    typeof document.metadata !== "object" ||
    document.metadata === null
  ) {
    return { markdown, title: null, statusCode: 0 };
  }

  const metadata = document.metadata;

  return {
    markdown,
    title: "title" in metadata && typeof metadata.title === "string" ? metadata.title : null,
    statusCode:
      "statusCode" in metadata && typeof metadata.statusCode === "number" ? metadata.statusCode : 0,
  };
}

function providerFailure(error: unknown): Error {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return new Error(data.message, { cause: error });
    }
  }

  return new Error("The Firecrawl component failed to scrape that page", { cause: error });
}

export async function scrapeAgendaThroughComponent(
  ctx: ScrapeActionCtx,
  component: ComponentApi,
  url: string,
): Promise<ScrapedPage> {
  assertAgendaUrl(url);

  const client = new FirecrawlClient(component);
  let document: unknown;

  try {
    document = await client.scrape(ctx, url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });
  } catch (error) {
    throw providerFailure(error);
  }

  return readScrapedPage(document);
}
