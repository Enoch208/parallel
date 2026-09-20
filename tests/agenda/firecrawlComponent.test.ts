import { describe, expect, it } from "vitest";
import { assertAgendaUrl, readScrapedPage } from "../../convex/model/firecrawlComponent";

describe("assertAgendaUrl", () => {
  it("accepts a public https agenda page", () => {
    expect(() => {
      assertAgendaUrl("https://www.viveevent.com/agenda/");
    }).not.toThrow();
  });

  it("rejects http, so a scrape never leaves the key on an unencrypted hop", () => {
    expect(() => {
      assertAgendaUrl("http://www.viveevent.com/agenda/");
    }).toThrow("Only public https agenda URLs are accepted");
  });

  it("rejects a scheme that only looks like https", () => {
    expect(() => {
      assertAgendaUrl("httpsx://www.viveevent.com/agenda/");
    }).toThrow("Only public https agenda URLs are accepted");
  });

  it("rejects file and data URLs", () => {
    expect(() => {
      assertAgendaUrl("file:///etc/passwd");
    }).toThrow("Only public https agenda URLs are accepted");
    expect(() => {
      assertAgendaUrl("data:text/html,<p>agenda</p>");
    }).toThrow("Only public https agenda URLs are accepted");
  });
});

describe("readScrapedPage", () => {
  it("keeps markdown, title and status code from a full document", () => {
    expect(
      readScrapedPage({
        markdown: "# Agenda\n\n10:00 Opening keynote",
        metadata: { title: "VIVE 2026 Agenda", statusCode: 200 },
      }),
    ).toEqual({
      markdown: "# Agenda\n\n10:00 Opening keynote",
      title: "VIVE 2026 Agenda",
      statusCode: 200,
    });
  });

  it("reports a missing title as null rather than inventing one", () => {
    expect(readScrapedPage({ markdown: "sessions", metadata: { statusCode: 200 } })).toEqual({
      markdown: "sessions",
      title: null,
      statusCode: 200,
    });
  });

  it("survives a document with no metadata at all", () => {
    expect(readScrapedPage({ markdown: "sessions" })).toEqual({
      markdown: "sessions",
      title: null,
      statusCode: 0,
    });
  });

  it("ignores metadata fields of the wrong type", () => {
    expect(
      readScrapedPage({ markdown: "sessions", metadata: { title: 12, statusCode: "200" } }),
    ).toEqual({ markdown: "sessions", title: null, statusCode: 0 });
  });

  it("throws rather than returning empty markdown", () => {
    expect(() => readScrapedPage({ markdown: "", metadata: { statusCode: 200 } })).toThrow(
      "Firecrawl returned no markdown for that page",
    );
  });

  it("throws when markdown is absent", () => {
    expect(() => readScrapedPage({ metadata: { statusCode: 404 } })).toThrow(
      "Firecrawl returned no markdown for that page",
    );
  });

  it("throws when markdown is not a string", () => {
    expect(() => readScrapedPage({ markdown: ["# Agenda"] })).toThrow(
      "Firecrawl returned no markdown for that page",
    );
  });

  it("rejects a payload that is not a document", () => {
    expect(() => readScrapedPage(null)).toThrow("Firecrawl returned an unexpected payload");
    expect(() => readScrapedPage("markdown")).toThrow("Firecrawl returned an unexpected payload");
    expect(() => readScrapedPage(undefined)).toThrow("Firecrawl returned an unexpected payload");
  });
});
