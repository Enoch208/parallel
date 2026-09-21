import { cx } from "@/lib/cx";

export interface ActivityRow {
  readonly id: string;
  readonly kind: string;
  readonly sponsor: string;
  readonly durationMs: number;
  readonly summary: string;
  readonly at: number;
}

const sponsorLabels: Record<string, string> = {
  firecrawl: "Firecrawl",
  openai: "OpenAI",
  agentmail: "AgentMail",
  convex: "Convex",
};

const sponsorStyles: Record<string, string> = {
  firecrawl: "bg-orange-500/15 text-orange-200",
  openai: "bg-emerald-500/15 text-emerald-200",
  agentmail: "bg-violet-500/15 text-violet-200",
  convex: "bg-blue-500/15 text-blue-200",
};

function formatClock(at: number): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(at),
  );
}

export function ActivityFeed({ rows }: { rows: readonly ActivityRow[] }) {
  return (
    <details
      open
      id="how-parallel-worked"
      className="scroll-mt-6 rounded-2xl border border-white/5 bg-white/[0.02]"
    >
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-white">
        How Parallel worked
      </summary>
      <ol className="flex flex-col gap-2 border-t border-white/5 px-5 py-4">
        {rows.length === 0 && (
          <li className="text-xs text-neutral-600">Nothing has happened in this workspace yet.</li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-3 text-xs">
            <span className="font-mono tabular-nums text-neutral-600">{formatClock(row.at)}</span>
            <span
              className={cx(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                sponsorStyles[row.sponsor] ?? "bg-white/10 text-neutral-300",
              )}
            >
              {sponsorLabels[row.sponsor] ?? row.sponsor}
            </span>
            <span className="flex-1 font-light text-neutral-400">{row.summary}</span>
            {row.durationMs > 0 && (
              <span className="font-mono tabular-nums text-neutral-600">
                {(row.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
