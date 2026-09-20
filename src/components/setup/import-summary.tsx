import type { ImportResult } from "@convex/importAgenda";
import { CounterTile } from "@/components/board/counter-tile";

export function ImportSummary({ result }: { result: ImportResult | null }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-light leading-relaxed text-neutral-500">
        {result === null
          ? "These counters stay empty until an import runs in this browser tab. They report what the last run in this tab actually returned, not a stored total."
          : "What the last import in this tab returned."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CounterTile
          label="Characters scraped"
          value={result === null ? null : result.scraped}
          caption="Markdown Firecrawl returned for the agenda page."
        />
        <CounterTile
          label="Sessions extracted"
          value={result === null ? null : result.extracted}
          caption="Rows the extraction model read out of that markdown."
        />
        <CounterTile
          label="Times validated"
          value={result === null ? null : result.validated}
          caption="Extracted rows whose start and end resolved in the conference timezone."
        />
        <CounterTile
          label="Sessions inserted"
          value={result === null ? null : result.inserted}
          caption="Rows written to this conference."
          emphasis
        />
        <CounterTile
          label="Dropped for bad times"
          value={result === null ? null : result.droppedForBadTimes}
          caption="Extracted rows with no usable start and end, kept out of the plan."
        />
      </div>
    </div>
  );
}
