import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import type { GenerateBriefResult } from "@convex/brief";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <span className="font-mono text-lg font-light tabular-nums text-white">{value}</span>
      <span className="text-[11px] font-light text-neutral-500">{label}</span>
    </div>
  );
}

export function BriefRunReport({ result }: { result: GenerateBriefResult }) {
  const dropped = [
    { label: "claims whose source was not in the notes given", count: result.unknownSourceClaims },
    { label: "sections emptied once unsourced claims were removed", count: result.emptiedSections },
    { label: "claims the model returned malformed", count: result.malformedClaims },
    { label: "sections the model returned malformed", count: result.malformedSections },
    {
      label: "sections written against a goal that does not exist",
      count: result.unknownGoalSections,
    },
  ].filter((entry) => entry.count > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="goal sections written" value={String(result.sections)} />
        <Stat label="sourced claims kept" value={String(result.claims)} />
        <Stat label="takeaways read" value={String(result.notesUsed)} />
        <Stat label="seconds to write" value={String(Math.round(result.durationMs / 100) / 10)} />
      </div>

      {dropped.length === 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-neutral-300">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-white">Nothing was dropped. </span>
            Every claim carried a source that was in the notes handed to the model.
          </span>
        </p>
      ) : (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-950/15 px-4 py-3 text-xs leading-relaxed text-amber-100"
        >
          <span className="flex items-center gap-2 font-medium">
            <HugeiconsIcon icon={Alert02Icon} size={14} className="shrink-0" />
            Dropped before this brief was stored
          </span>
          <ul className="flex flex-col gap-1 pl-6">
            {dropped.map((entry) => (
              <li key={entry.label} className="list-disc">
                <span className="font-mono tabular-nums">{entry.count}</span> {entry.label}
              </li>
            ))}
          </ul>
          <span className="pl-6 text-amber-200/80">
            The brief below is what survived. It is short by exactly this much.
          </span>
        </div>
      )}

      <p className="text-[11px] font-light text-neutral-500">
        Written by {result.model}.{" "}
        {result.recipients.length === 0
          ? "No lead has an email on this team yet, so it is addressed to nobody."
          : `Addressed to ${result.recipients.join(", ")}.`}
      </p>
    </div>
  );
}
