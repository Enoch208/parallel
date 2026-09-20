import type { CoverageSummary } from "@convex/model/types";
import { CounterTile } from "./counter-tile";

export function BoardCounters({ coverage }: { coverage: CoverageSummary | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <CounterTile
        emphasis
        label="Team Goal Coverage"
        value={coverage === null ? null : Math.round(coverage.teamGoalCoverage)}
        caption="How strongly the team's assigned sessions cover its weighted goals, with diminishing returns for redundant sessions. 0 to 100."
      />
      <CounterTile
        label="Unique sessions assigned"
        value={coverage === null ? null : coverage.uniqueSessions}
        caption={
          coverage === null
            ? "Out of the most the team could physically attend."
            : `Out of ${String(coverage.maxAttendableSessions)} the team could physically attend.`
        }
      />
      <CounterTile
        label="Duplicate attendances"
        value={coverage === null ? null : coverage.duplicateAttendances}
        caption="Times two teammates sit in the same session. Sometimes right, so it is reported, not forbidden."
      />
    </div>
  );
}
