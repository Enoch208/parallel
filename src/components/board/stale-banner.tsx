import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

export function StaleBanner({
  reason,
  onRepair,
  repairing,
}: {
  reason: string;
  onRepair: () => void;
  repairing: boolean;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 md:flex-row md:items-center md:justify-between"
    >
      <span className="flex items-start gap-3 text-sm text-amber-100">
        <HugeiconsIcon icon={Alert02Icon} size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong className="font-medium">Plan is stale.</strong> {reason}
        </span>
      </span>
      <button
        type="button"
        onClick={onRepair}
        disabled={repairing}
        className="w-fit shrink-0 rounded-full bg-amber-400 px-5 py-2 text-xs font-medium text-black transition-colors hover:bg-amber-300 disabled:opacity-60"
      >
        {repairing ? "Repairing…" : "Repair the plan"}
      </button>
    </div>
  );
}
