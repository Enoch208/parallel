import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { cx } from "@/lib/cx";

export type TripSummary = NonNullable<FunctionReturnType<typeof api.brief.latest>>["tripSummary"];

function Figure({
  label,
  value,
  caption,
  emphasis = false,
}: {
  label: string;
  value: string | null;
  caption: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-2xl border p-5",
        emphasis ? "border-blue-500/25 bg-blue-950/15" : "border-white/5 bg-white/[0.02]",
      )}
    >
      <span
        className={cx(
          "font-mono text-2xl font-light tabular-nums",
          value === null ? "text-neutral-700" : "text-white",
        )}
      >
        {value ?? "—"}
      </span>
      <span className="text-xs font-medium text-white">{label}</span>
      <span className="text-[11px] leading-relaxed font-light text-neutral-500">{caption}</span>
    </div>
  );
}

export function TripSummaryCard({ summary }: { summary: TripSummary }) {
  const count = (value: number) => String(value);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-white">
          {summary.eventName}: what the trip returned
        </h3>
        <p className="max-w-xl text-xs leading-relaxed font-light text-neutral-500">
          Every figure here is computed from the plan and the takeaways on this conference. Nothing
          on this card is estimated by Parallel.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Figure
          emphasis
          label="Team Goal Coverage"
          value={`${count(summary.coverageBefore)} → ${count(summary.coverageAfter)}`}
          caption={`Before the split, then after it. Gain ${count(summary.coverageGain)} on a 0 to 100 scale.`}
        />
        <Figure
          label="Sessions covered"
          value={`${count(summary.sessionsUniquelyCovered)} of ${count(summary.sessionsAvailable)}`}
          caption={`Unique sessions the team is assigned to, out of the agenda. ${count(summary.duplicateAttendances)} duplicate attendances.`}
        />
        <Figure
          label="Goals represented"
          value={`${count(summary.goalsRepresented)} of ${count(summary.goalsTotal)}`}
          caption="Goals with at least one assigned session contributing to them."
        />
        <Figure
          label="Takeaways captured"
          value={count(summary.takeawaysCaptured)}
          caption={`Across ${count(summary.sessionsWithTakeaways)} sessions. These are the only evidence the brief may cite.`}
        />
        <Figure
          label="Attendees"
          value={count(summary.attendees)}
          caption="Teammates on this trip."
        />
        <Figure
          label="Trip cost estimate"
          value={summary.tripCostEstimate === null ? null : count(summary.tripCostEstimate)}
          caption={summary.tripCostEstimateLabel}
        />
      </div>

      <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-neutral-400">
        <span className="font-medium text-white">Cost per session covered: </span>
        <span className="font-mono tabular-nums">
          {summary.costPerSessionCovered === null ? "—" : count(summary.costPerSessionCovered)}
        </span>
        <span className="text-neutral-500">
          {" "}
          — the lead&rsquo;s own estimate divided by the sessions covered.{" "}
          {summary.tripCostEstimateLabel}.
        </span>
      </p>
    </section>
  );
}
