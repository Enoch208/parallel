import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ErrorNote, PrimaryButton, errorMessage } from "@/components/setup/setup-shell";

interface SendReport {
  readonly sent: number;
  readonly skipped: number;
  readonly held: readonly string[];
}

export function BriefSendPanel({
  briefId,
  recipients,
  alreadySent,
}: {
  briefId: string;
  recipients: readonly string[];
  alreadySent: boolean;
}) {
  const send = useAction(api.emailSend.sendBrief);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SendReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deliver = async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await send({ briefId: briefId as Id<"briefs"> });
      setReport({
        sent: result.sent,
        skipped: result.skipped,
        held: result.outcomes
          .filter((outcome) => outcome.status === "budget_exhausted")
          .map((outcome) => outcome.email),
      });
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (recipients.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-neutral-500">
        Add a recipient above before sending. The brief only goes to people the lead adds by hand.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/20 p-4">
      <p className="text-xs leading-relaxed text-neutral-400">
        Sends this brief by email to {recipients.join(", ")}. Each address receives it once, however
        many times this is pressed.
      </p>
      <PrimaryButton onClick={() => void deliver()} disabled={busy}>
        {busy ? "Sending…" : alreadySent ? "Send to anyone not yet reached" : "Send the brief"}
      </PrimaryButton>
      {report !== null && (
        <p role="status" className="text-xs leading-relaxed text-neutral-300">
          Delivered to {report.sent} {report.sent === 1 ? "address" : "addresses"}
          {report.skipped > 0 ? `, ${String(report.skipped)} already had it` : ""}
          {report.held.length > 0
            ? `. Held back by today's send budget: ${report.held.join(", ")}`
            : ""}
          .
        </p>
      )}
      {error !== null && <ErrorNote message={error} />}
    </div>
  );
}
