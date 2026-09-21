import type { SessionSummary } from "@convex/model/types";
import { SessionCard, type CardState } from "./session-card";
import { formatTimeRange } from "@/lib/format-time";

export interface LaneCard {
  readonly session: SessionSummary;
  readonly state: CardState;
  readonly reason: string | null;
}

export function LaneColumn({
  memberName,
  isLead,
  cards,
  timezone,
  claimable,
  onRelease,
  onClaim,
}: {
  memberName: string;
  isLead: boolean;
  cards: readonly LaneCard[];
  timezone: string;
  claimable: readonly SessionSummary[];
  onRelease?: (sessionId: string) => void;
  onClaim?: (sessionId: string) => void;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 lg:min-w-[186px]">
      <header className="flex items-baseline gap-2 border-b border-white/5 pb-2">
        <h3 className="text-sm font-medium text-white">{memberName}</h3>
        {isLead && (
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">Lead</span>
        )}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-neutral-400">
          {cards.length}
        </span>
      </header>

      {cards.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-neutral-500">
          No session here adds coverage the team does not already have, so this teammate is free.
          They can still take one below.
        </p>
      )}

      {cards.map((card) => (
        <SessionCard
          key={card.session.id}
          session={card.session}
          timezone={timezone}
          state={card.state}
          reason={card.reason}
          {...(onRelease === undefined
            ? {}
            : {
                onRelease: () => {
                  onRelease(card.session.id);
                },
              })}
        />
      ))}

      {onClaim !== undefined && claimable.length > 0 && (
        <label className="flex flex-col gap-1.5 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">
            Add a session
          </span>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value.length > 0) {
                onClaim(event.target.value);
              }
            }}
            className="min-h-10 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs text-neutral-300 md:min-h-0"
          >
            <option value="">Choose a session…</option>
            {claimable.map((session) => (
              <option key={session.id} value={session.id}>
                {formatTimeRange(session.startsAt, session.endsAt, timezone)} · {session.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
