import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroupIcon } from "@hugeicons/core-free-icons";

export interface CoverCandidate {
  readonly membershipId: string;
  readonly displayName: string;
  readonly coverageGain: number;
  readonly topGoalLabel: string | null;
  readonly reasons: readonly string[];
}

export function CoverCard({
  sessionTitle,
  candidate,
  asking,
  onAsk,
}: {
  sessionTitle: string;
  candidate: CoverCandidate;
  asking: boolean;
  onAsk: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-blue-500/25 bg-blue-950/15 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
          <HugeiconsIcon icon={UserGroupIcon} size={15} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white">
            {candidate.displayName} is the best replacement for &ldquo;{sessionTitle}&rdquo;
          </span>
          <span className="font-mono text-xs tabular-nums text-blue-200">
            +{candidate.coverageGain.toFixed(1)} Team Goal Coverage
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 pl-11">
        {candidate.reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-xs font-light text-neutral-400">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
            {reason}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAsk}
        disabled={asking}
        className="ml-11 flex min-h-10 w-fit items-center rounded-full bg-white px-5 text-xs font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
      >
        {asking ? "Asking…" : `Ask ${candidate.displayName}`}
      </button>
    </div>
  );
}
