import type { ConstraintTrail, ReplyRecord } from "@convex/evidence";
import type { Id } from "@convex/_generated/dataModel";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { formatTimeRange } from "@/lib/format-time";
import { EvidenceEmpty, Quoted } from "./evidence-primitives";
import { ResolveReply } from "./resolve-reply";

function ReplyLine({ reply }: { reply: ReplyRecord }) {
  const parts = [
    reply.fromAddress,
    reply.intent === null ? null : `read as ${reply.intent}`,
    reply.confidence === null ? null : `confidence ${reply.confidence.toFixed(2)}`,
    reply.resolvedByHand ? "resolved by hand" : null,
  ].filter((part): part is string => part !== null);

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
      <HugeiconsIcon icon={Mail01Icon} size={12} className="shrink-0" />
      <span className="break-all">{parts.join(" · ")}</span>
    </span>
  );
}

export function ConstraintEvidence({
  trail,
  timezone,
  conferenceId,
}: {
  trail: ConstraintTrail;
  timezone: string;
  conferenceId: Id<"conferences">;
}) {
  if (trail.blocks.length === 0 && trail.unlinkedReplies.length === 0) {
    return (
      <EvidenceEmpty
        title="Nothing has changed the plan yet"
        description="No teammate has blocked a slot and no reply has been parsed on this conference, so there is no constraint trail to show."
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {trail.blocks.length === 0 ? (
        <EvidenceEmpty
          title="No availability blocks recorded"
          description="Nobody is blocked out of a slot on this conference."
        />
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {trail.blocks.map((block) => (
            <li
              key={block.blockId}
              className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium break-words text-white">
                  {block.memberName}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                  {formatTimeRange(block.startsAt, block.endsAt, timezone)}
                </span>
              </div>

              <p className="text-xs font-light text-neutral-400">
                Stored reason: <span className="text-neutral-200">{block.reason}</span>
              </p>

              {block.sourceQuote === null ? (
                <p className="text-[11px] text-neutral-500">
                  This block carries no quoted sentence. It was entered directly rather than parsed
                  from a reply.
                </p>
              ) : (
                <Quoted text={block.sourceQuote} />
              )}

              {block.reply === null ? (
                <p className="text-[11px] text-neutral-500">
                  No inbound email on this conference carries that exact sentence for this teammate,
                  so no email row is claimed as its origin.
                </p>
              ) : (
                <div className="flex min-w-0 flex-col gap-1 border-t border-white/5 pt-2.5">
                  <span className="text-[11px] font-medium text-neutral-400 break-words">
                    Matched to the reply {block.reply.subject}
                  </span>
                  <ReplyLine reply={block.reply} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {trail.unlinkedReplies.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.01] p-4">
          <h4 className="text-xs font-medium text-white">
            Inbound replies that did not create a block
          </h4>
          <p className="text-[11px] leading-relaxed font-light text-neutral-500">
            These arrived and were parsed, but Parallel could not tell which session they meant, so
            it applied nothing rather than guess. A person can resolve one below; the original email
            is kept and the change is recorded as resolved by hand.
          </p>
          <ul className="flex min-w-0 flex-col gap-2 pt-1">
            {trail.unlinkedReplies.map((reply) => (
              <li key={reply.eventId} className="flex min-w-0 flex-col gap-1.5">
                {reply.quote !== null && <Quoted text={reply.quote} />}
                <ReplyLine reply={reply} />
                <ResolveReply reply={reply} conferenceId={conferenceId} timezone={timezone} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
