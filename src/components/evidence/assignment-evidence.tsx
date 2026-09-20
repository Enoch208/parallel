import type { PlanProvenance } from "@convex/evidence";
import { HugeiconsIcon } from "@hugeicons/react";
import { PinIcon } from "@hugeicons/core-free-icons";
import { formatTimeRange } from "@/lib/format-time";
import { EvidenceEmpty } from "./evidence-primitives";

export function AssignmentEvidence({
  plan,
  timezone,
}: {
  plan: PlanProvenance | null;
  timezone: string;
}) {
  if (plan === null) {
    return (
      <EvidenceEmpty
        title="No plan computed yet"
        description="Nobody has been placed anywhere, so there are no assignments to explain. Run the optimizer on the Board screen and every row it writes shows up here with its stored reason."
      />
    );
  }

  if (plan.assignments.length === 0) {
    return (
      <EvidenceEmpty
        title="This plan holds no assignments"
        description={`Plan ${plan.planId} was computed at revision ${String(plan.computedAtRevision)} and stored zero assignments.`}
      />
    );
  }

  const stale = plan.computedAtRevision !== plan.conferenceRevision;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-[11px] leading-relaxed font-light text-neutral-500">
        Latest plan, status {plan.status}, computed at constraint revision{" "}
        <span className="font-mono tabular-nums text-neutral-300">
          {String(plan.computedAtRevision)}
        </span>
        . The conference is now at revision{" "}
        <span className="font-mono tabular-nums text-neutral-300">
          {String(plan.conferenceRevision)}
        </span>
        . {stale ? "Stale: constraints changed after this plan was computed." : "Up to date."}
      </p>

      <ul className="flex min-w-0 flex-col gap-2">
        {plan.assignments.map((assignment) => (
          <li
            key={assignment.assignmentId}
            className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:flex-row md:items-start md:gap-4"
          >
            <div className="flex min-w-0 shrink-0 flex-col gap-0.5 md:w-44">
              <span className="text-sm font-medium break-words text-white">
                {assignment.memberName}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                {formatTimeRange(assignment.startsAt, assignment.endsAt, timezone)}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm leading-snug break-words text-neutral-200">
                {assignment.sessionTitle}
              </span>
              <p className="text-xs leading-relaxed font-light break-words text-neutral-400">
                {assignment.reason}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {assignment.pinned && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-200">
                    <HugeiconsIcon icon={PinIcon} size={11} className="shrink-0" />
                    Pinned
                  </span>
                )}
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] tabular-nums text-neutral-400">
                  revision {String(assignment.computedAtRevision)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
