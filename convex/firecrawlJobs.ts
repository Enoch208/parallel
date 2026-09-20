import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { scrapeAgendaThroughComponent, type ScrapedPage } from "./model/firecrawlComponent";

export const scrapeAgendaPage = internalAction({
  args: { url: v.string() },
  handler: (ctx, args): Promise<ScrapedPage> =>
    scrapeAgendaThroughComponent(ctx, components.firecrawl, args.url),
});
