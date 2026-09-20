import { useState } from "react";
import type { TeamMemberSummary } from "@convex/board";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { ErrorNote, PrimaryButton, SetupPanel, TextField } from "./setup-shell";

export function TeammatePanel({
  members,
  adding,
  failure,
  onAdd,
}: {
  members: readonly TeamMemberSummary[];
  adding: boolean;
  failure: string | null;
  onAdd: (displayName: string, email: string, isLead: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isLead, setIsLead] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const name = displayName.trim();
    const address = email.trim();

    if (name.length === 0) {
      setInvalid("A teammate needs a name.");
      return;
    }

    if (!address.includes("@") || address.startsWith("@") || address.endsWith("@")) {
      setInvalid("A teammate needs an email address, because the plan reaches them by email.");
      return;
    }

    setInvalid(null);
    setDisplayName("");
    setEmail("");
    setIsLead(false);
    onAdd(name, address, isLead);
  };

  return (
    <SetupPanel
      title="Who is going"
      description="Teammates never open Parallel. Their plan arrives by email and their replies come back into the board, so the address matters as much as the name."
    >
      {members.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-xs text-neutral-400">
          Nobody is on this team yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-white">{member.displayName}</span>
                <span className="break-all font-mono text-[11px] text-neutral-400">
                  {member.email}
                </span>
              </span>
              {member.isLead && (
                <span className="shrink-0 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-medium text-blue-300">
                  Lead
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className="flex flex-col gap-4 border-t border-white/5 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="teammate-name"
            label="Name"
            value={displayName}
            onChange={setDisplayName}
            disabled={adding}
          />
          <TextField
            id="teammate-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            disabled={adding}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="teammate-lead"
            type="checkbox"
            checked={isLead}
            disabled={adding}
            onChange={(event) => {
              setIsLead(event.target.checked);
            }}
            className="size-5 shrink-0 rounded border-white/20 bg-white/[0.03] accent-blue-500 disabled:opacity-60"
          />
          <label
            htmlFor="teammate-lead"
            className="flex min-h-10 items-center text-xs font-medium text-neutral-400"
          >
            Lead — approves changes that move other people
          </label>
        </div>

        {invalid !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {invalid}
          </p>
        )}
        {failure !== null && <ErrorNote message={failure} />}

        <PrimaryButton type="submit" disabled={adding}>
          <HugeiconsIcon icon={UserAdd01Icon} size={15} />
          {adding ? "Adding…" : "Add teammate"}
        </PrimaryButton>
      </form>
    </SetupPanel>
  );
}
