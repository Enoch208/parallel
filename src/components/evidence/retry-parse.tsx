import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ReplyRecord } from "@convex/evidence";
import { ErrorNote, errorMessage } from "@/components/setup/setup-shell";

export function ParseState({ reply }: { reply: ReplyRecord }) {
  const retry = useMutation(api.replyParsing.retryReplyParsing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reply.parseState === "queued") {
    return <p className="text-[11px] text-neutral-400">Being read now. Nothing is applied yet.</p>;
  }

  if (reply.parseState !== "failed") {
    return null;
  }

  const run = async () => {
    setBusy(true);
    setError(null);

    try {
      await retry({ eventId: reply.eventId as Id<"emailEvents"> });
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-red-500/20 bg-red-950/10 p-3">
      <p className="text-xs leading-relaxed text-red-200">
        {reply.parseFailure ?? "Reply parsing failed. Original email preserved."}
      </p>
      <button
        type="button"
        onClick={() => {
          void run();
        }}
        disabled={busy}
        className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-60"
      >
        {busy ? "Queuing…" : "Retry parsing"}
      </button>
      {error !== null && <ErrorNote message={error} />}
    </div>
  );
}
