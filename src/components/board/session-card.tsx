import type { SessionSummary } from "@convex/model/types";
import { cx } from "@/lib/cx";
import { formatTimeRange } from "@/lib/format-time";

export type CardState = "assigned" | "duplicate" | "gap" | "pinned";

const stateStyles: Record<CardState, string> = {
  assigned: "border-white/8 bg-white/[0.04] hover:bg-white/[0.06]",
  pinned: "border-blue-500/30 bg-blue-950/20",
  duplicate: "border-white/8 bg-white/[0.03]",
  gap: "border-amber-500/40 bg-amber-950/20",
};

const stateLabels: Record<CardState, string | null> = {
  assigned: null,
  pinned: "Pinned",
  duplicate: "Also covered by a teammate",
  gap: "Needs cover",
};

export function SessionCard({
  session,
  timezone,
  state,
  reason,
  onRelease,
}: {
  session: SessionSummary;
  timezone: string;
  state: CardState;
  reason: string | null;
  onRelease?: () => void;
}) {
  const label = stateLabels[state];

  return (
    <article
      className={cx(
        "flex flex-col gap-2 rounded-2xl border p-4 transition-colors",
        stateStyles[state],
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">
          {formatTimeRange(session.startsAt, session.endsAt, timezone)}
        </span>
        {session.track !== null && (
          <span className="truncate text-[10px] uppercase tracking-wider text-neutral-600">
            {session.track}
          </span>
        )}
      </div>

      <h4 className="text-sm font-medium leading-snug text-white">{session.title}</h4>

      {session.room !== null && <span className="text-xs text-neutral-500">{session.room}</span>}

      {label !== null && (
        <span
          className={cx(
            "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium",
            state === "gap" ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-neutral-300",
          )}
        >
          {label}
        </span>
      )}

      {reason !== null && (
        <p className="text-[11px] font-light leading-relaxed text-neutral-500">{reason}</p>
      )}

      {onRelease !== undefined && (
        <button
          type="button"
          onClick={onRelease}
          className="w-fit text-[11px] font-medium text-neutral-500 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          Release
        </button>
      )}
    </article>
  );
}
