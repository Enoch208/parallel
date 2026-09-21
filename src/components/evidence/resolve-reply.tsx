import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ReplyRecord } from "@convex/evidence";
import {
  ErrorNote,
  PrimaryButton,
  errorMessage,
  fieldClass,
  fieldLabelClass,
} from "@/components/setup/setup-shell";
import { formatTimeRange } from "@/lib/format-time";

const intents = [
  { value: "cant_attend", label: "Cannot attend" },
  { value: "takeaways", label: "Takeaway" },
  { value: "pin", label: "Pin this session" },
] as const;

type ResolvableIntent = (typeof intents)[number]["value"];

function isResolvable(intent: string | null): intent is ResolvableIntent {
  return intents.some((option) => option.value === intent);
}

export function ResolveReply({
  reply,
  conferenceId,
  timezone,
}: {
  reply: ReplyRecord;
  conferenceId: Id<"conferences">;
  timezone: string;
}) {
  const sessions = useQuery(api.board.conferenceSessions, { conferenceId });
  const resolve = useMutation(api.emailReplies.resolveByHand);
  const [intent, setIntent] = useState<ResolvableIntent>(
    isResolvable(reply.intent) ? reply.intent : "cant_attend",
  );
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intentField = useId();
  const sessionField = useId();

  const apply = async () => {
    setBusy(true);
    setError(null);

    try {
      await resolve({
        eventId: reply.eventId as Id<"emailEvents">,
        sessionId: sessionId as Id<"sessions">,
        intent,
      });
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <label htmlFor={intentField} className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabelClass}>They meant</span>
          <select
            id={intentField}
            value={intent}
            onChange={(event) => {
              const next = event.target.value;
              if (isResolvable(next)) {
                setIntent(next);
              }
            }}
            className={fieldClass}
          >
            {intents.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={sessionField} className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabelClass}>For the session</span>
          <select
            id={sessionField}
            value={sessionId}
            onChange={(event) => {
              setSessionId(event.target.value);
            }}
            className={fieldClass}
          >
            <option value="">Choose a session…</option>
            {(sessions ?? []).map((session) => (
              <option key={session.id} value={session.id}>
                {formatTimeRange(session.startsAt, session.endsAt, timezone)} · {session.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        Applying keeps the original email and records that a person resolved it, not the parser.
      </p>
      <PrimaryButton onClick={() => void apply()} disabled={busy || sessionId === ""}>
        {busy ? "Applying…" : "Resolve reply"}
      </PrimaryButton>
      {error !== null && <ErrorNote message={error} />}
    </div>
  );
}
