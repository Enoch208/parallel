import type { SessionSummary } from "@convex/model/types";
import { SessionCard, type CardState } from "./session-card";

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
  onRelease,
}: {
  memberName: string;
  isLead: boolean;
  cards: readonly LaneCard[];
  timezone: string;
  onRelease?: (sessionId: string) => void;
}) {
  return (
    <section className="flex min-w-[240px] flex-1 flex-col gap-3">
      <header className="flex items-baseline gap-2 border-b border-white/5 pb-2">
        <h3 className="text-sm font-medium text-white">{memberName}</h3>
        {isLead && (
          <span className="text-[10px] uppercase tracking-wider text-neutral-600">Lead</span>
        )}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-neutral-500">
          {cards.length}
        </span>
      </header>

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-neutral-600">
          Nothing assigned yet.
        </p>
      ) : (
        cards.map((card) => (
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
        ))
      )}
    </section>
  );
}
