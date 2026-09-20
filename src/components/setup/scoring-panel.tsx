import type { ScoreConferenceResult } from "@convex/scoring";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon } from "@hugeicons/core-free-icons";
import { ErrorNote, PrimaryButton, SetupPanel } from "./setup-shell";

function measuredRows(
  result: ScoreConferenceResult | null,
): readonly { key: string; value: string }[] {
  if (result === null) {
    return [
      { key: "Model", value: "—" },
      { key: "Session and goal pairs scored", value: "—" },
      { key: "Pairs the model did not return", value: "—" },
      { key: "Scores written", value: "—" },
      { key: "Model calls", value: "—" },
      { key: "Measured duration", value: "—" },
    ];
  }

  return [
    { key: "Model", value: result.model },
    {
      key: "Session and goal pairs scored",
      value: `${String(result.pairsScored)} of ${String(result.pairsRequested)}`,
    },
    { key: "Pairs the model did not return", value: String(result.pairsDropped) },
    {
      key: "Scores written",
      value: `${String(result.inserted)} new, ${String(result.replaced)} replaced`,
    },
    {
      key: "Model calls",
      value: `${String(result.calls)} across ${String(result.sessions)} sessions and ${String(result.goals)} goals`,
    },
    { key: "Measured duration", value: `${(result.durationMs / 1000).toFixed(1)}s` },
  ];
}

export function ScoringPanel({
  result,
  scoring,
  failure,
  blocked,
  onScore,
}: {
  result: ScoreConferenceResult | null;
  scoring: boolean;
  failure: string | null;
  blocked: string | null;
  onScore: () => void;
}) {
  return (
    <SetupPanel
      title="Score the agenda against these goals"
      description="A model reads each session and rates how much it serves each goal. That rating is advisory input only: the deterministic optimizer decides who attends what, and it is the only thing that assigns anyone."
      aside={
        <PrimaryButton onClick={onScore} disabled={scoring || blocked !== null}>
          <HugeiconsIcon icon={AiBrain01Icon} size={15} />
          {scoring ? "Scoring…" : "Score sessions"}
        </PrimaryButton>
      }
    >
      {blocked !== null && <p className="text-xs text-amber-200">{blocked}</p>}
      {failure !== null && <ErrorNote message={failure} />}

      <dl className="grid gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 sm:grid-cols-2">
        {measuredRows(result).map((row) => (
          <div key={row.key} className="flex flex-col gap-1 bg-neutral-950 px-4 py-3">
            <dt className="text-[11px] font-medium text-neutral-500">{row.key}</dt>
            <dd className="font-mono text-sm tabular-nums text-white">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[11px] font-light leading-relaxed text-neutral-400" aria-live="polite">
        {result === null
          ? "These read — until a scoring run in this tab returns its own measurements."
          : "Measured by the run that finished in this tab."}
      </p>
    </SetupPanel>
  );
}
