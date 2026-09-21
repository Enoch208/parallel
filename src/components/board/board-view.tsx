import type { CoverageSummary, SessionSummary } from "@convex/model/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShuffleIcon } from "@hugeicons/core-free-icons";
import { BoardCounters } from "./board-counters";
import { SolverNote } from "./solver-note";
import { LaneColumn, type LaneCard } from "./lane-column";
import { StaleBanner } from "./stale-banner";

export interface BoardLane {
  readonly membershipId: string;
  readonly memberName: string;
  readonly isLead: boolean;
  readonly cards: readonly LaneCard[];
  readonly claimable: readonly SessionSummary[];
}

export function BoardView({
  lanes,
  coverage,
  solverStatus,
  objective,
  upperBound,
  timezone,
  showDay,
  staleReason,
  optimizing,
  repairing,
  onOptimize,
  onRepair,
  onRelease,
  onClaim,
}: {
  lanes: readonly BoardLane[];
  coverage: CoverageSummary | null;
  solverStatus: "optimal" | "heuristic" | null;
  objective: number | null;
  upperBound: number | null;
  timezone: string;
  showDay: boolean;
  staleReason: string | null;
  optimizing: boolean;
  repairing: boolean;
  onOptimize: () => void;
  onRepair: () => void;
  onRelease: (membershipId: string, sessionId: string) => void;
  onClaim: (membershipId: string, sessionId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <BoardCounters coverage={coverage} />

      <SolverNote solverStatus={solverStatus} objective={objective} upperBound={upperBound} />

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

      <div className="no-scrollbar flex flex-col gap-4 pb-4 lg:flex-row lg:overflow-x-auto">
        {lanes.map((lane) => (
          <LaneColumn
            key={lane.membershipId}
            memberName={lane.memberName}
            isLead={lane.isLead}
            cards={lane.cards}
            timezone={timezone}
            showDay={showDay}
            claimable={lane.claimable}
            onRelease={(sessionId) => {
              onRelease(lane.membershipId, sessionId);
            }}
            onClaim={(sessionId) => {
              onClaim(lane.membershipId, sessionId);
            }}
          />
        ))}
      </div>
    </div>
  );
}
