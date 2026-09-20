import type { CoverageSummary } from "@convex/model/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShuffleIcon } from "@hugeicons/core-free-icons";
import { BoardCounters } from "./board-counters";
import { LaneColumn, type LaneCard } from "./lane-column";
import { StaleBanner } from "./stale-banner";

export interface BoardLane {
  readonly membershipId: string;
  readonly memberName: string;
  readonly isLead: boolean;
  readonly cards: readonly LaneCard[];
}

export function BoardView({
  lanes,
  coverage,
  timezone,
  staleReason,
  optimizing,
  repairing,
  onOptimize,
  onRepair,
  onRelease,
}: {
  lanes: readonly BoardLane[];
  coverage: CoverageSummary | null;
  timezone: string;
  staleReason: string | null;
  optimizing: boolean;
  repairing: boolean;
  onOptimize: () => void;
  onRepair: () => void;
  onRelease: (membershipId: string, sessionId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <BoardCounters coverage={coverage} />

      {staleReason !== null && (
        <StaleBanner reason={staleReason} onRepair={onRepair} repairing={repairing} />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-500">
          One lane per teammate. Claiming or releasing a session updates every screen.
        </p>
        <button
          type="button"
          onClick={onOptimize}
          disabled={optimizing}
          className="flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
        >
          <HugeiconsIcon icon={ShuffleIcon} size={15} />
          {optimizing ? "Optimizing…" : "Optimize"}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {lanes.map((lane) => (
          <LaneColumn
            key={lane.membershipId}
            memberName={lane.memberName}
            isLead={lane.isLead}
            cards={lane.cards}
            timezone={timezone}
            onRelease={(sessionId) => {
              onRelease(lane.membershipId, sessionId);
            }}
          />
        ))}
      </div>
    </div>
  );
}
