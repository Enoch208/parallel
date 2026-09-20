import { cx } from "@/lib/cx";

const stepOrder = [
  { key: "fetch agenda", label: "Fetching the published page" },
  { key: "importWrites:recordSource", label: "Recording where it came from" },
  { key: "normalize sessions", label: "Reading sessions out of the page" },
  { key: "importWrites:insertSessions", label: "Saving the sessions" },
  { key: "importScoringFinished", label: "Scoring against the team's goals" },
] as const;

export function WorkflowProgress({
  type,
  running,
  error,
}: {
  type: "inProgress" | "completed" | "canceled" | "failed";
  running: readonly string[];
  error: string | null;
}) {
  const finished = type === "completed";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-white">Durable import</span>
        <span className="text-xs text-neutral-400">
          {type === "completed"
            ? "Finished"
            : type === "failed"
              ? "Stopped"
              : type === "canceled"
                ? "Cancelled"
                : "Running"}
        </span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {stepOrder.map((step) => {
          const done = finished;
          const active = running.includes(step.key) && type === "inProgress";

          return (
            <li key={step.key} className="flex items-center gap-2.5 text-xs">
              <span
                aria-hidden
                className={cx(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  done ? "bg-blue-400" : active ? "bg-white" : "bg-white/15",
                )}
              />
              <span
                className={cx(
                  "font-light",
                  done || active ? "text-neutral-300" : "text-neutral-500",
                )}
              >
                {step.label}
              </span>
              {active && <span className="text-[10px] text-neutral-400">working…</span>}
              {done && <span className="text-[10px] text-blue-300">done</span>}
            </li>
          );
        })}
      </ol>

      {error !== null && (
        <p role="alert" className="text-xs text-amber-200">
          {error}
        </p>
      )}

      <p className="text-[11px] font-light leading-relaxed text-neutral-400">
        Each step is recorded as it completes, so a step that already succeeded is never repeated if
        the run is interrupted.
      </p>
    </div>
  );
}
