import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  ErrorNote,
  PrimaryButton,
  SetupPanel,
  TextField,
  errorMessage,
} from "@/components/setup/setup-shell";

export interface BriefRecipient {
  readonly id: string;
  readonly email: string;
}

export function RecipientPanel({
  recipients,
  teamRecipients,
  onAdd,
  onRemove,
}: {
  recipients: readonly BriefRecipient[];
  teamRecipients: readonly string[];
  onAdd: (email: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes("@")) {
      setError("A recipient needs an email address, because the brief is delivered by email.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onAdd(email.trim());
      setEmail("");
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SetupPanel
      title="Who the brief goes to"
      description="Team leads are included automatically. Add the people who paid for the trip."
    >
      <ul className="flex flex-wrap gap-2">
        {teamRecipients.map((address) => (
          <li
            key={address}
            className="flex min-h-10 max-w-full items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs break-all text-neutral-400 sm:min-h-0"
          >
            {address} · team lead
          </li>
        ))}
        {recipients.map((recipient) => (
          <li
            key={recipient.id}
            className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-blue-500/25 bg-blue-950/20 px-3 py-1 text-xs text-blue-100 sm:min-h-0"
          >
            <span className="break-all">{recipient.email} · added by the lead</span>
            <button
              type="button"
              aria-label={`Remove ${recipient.email}`}
              onClick={() => {
                void onRemove(recipient.id);
              }}
              className="flex min-h-10 shrink-0 items-center justify-center px-1 text-blue-300 transition-colors hover:text-white sm:min-h-0"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} />
            </button>
          </li>
        ))}
      </ul>

      <TextField
        id="brief-recipient"
        label="Add a recipient"
        value={email}
        placeholder="stakeholder@company.com"
        disabled={busy}
        onChange={setEmail}
      />

      {error !== null && <ErrorNote message={error} />}

      <PrimaryButton
        disabled={busy}
        onClick={() => {
          void submit();
        }}
      >
        {busy ? "Adding…" : "Add recipient"}
      </PrimaryButton>
    </SetupPanel>
  );
}
