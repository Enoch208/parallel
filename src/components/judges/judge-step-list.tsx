import type { JudgeRun } from "@convex/judges";

type Step = JudgeRun["steps"][number];

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-lg tabular-nums text-white">
        {value === null ? "—" : value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
    </div>
  );
}

export function JudgeStepList({ steps }: { steps: readonly Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-white">
              {index + 1}. {step.label}
            </span>
            <span className="text-xs font-light leading-relaxed text-neutral-400">
              {step.detail}
            </span>
          </div>

          <div className="flex shrink-0 gap-6">
            <Figure label="Coverage" value={step.coverage} />
            <Figure label="Unique" value={step.uniqueSessions} />
            <Figure label="Duplicates" value={step.duplicateAttendances} />
          </div>
        </li>
      ))}
    </ol>
  );
}
