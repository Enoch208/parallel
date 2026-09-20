import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MessageAdd01Icon } from "@hugeicons/core-free-icons";
import type { TeamMemberSummary } from "@convex/board";
import type { SessionSummary } from "@convex/model/types";
import {
  ErrorNote,
  PrimaryButton,
  SetupPanel,
  fieldClass,
  fieldLabelClass,
} from "@/components/setup/setup-shell";
import { formatTimeRange } from "@/lib/format-time";

export function NoteForm({
  sessions,
  members,
  timezone,
  adding,
  failure,
  onAdd,
}: {
  sessions: readonly SessionSummary[];
  members: readonly TeamMemberSummary[];
  timezone: string;
  adding: boolean;
  failure: string | null;
  onAdd: (sessionId: string, membershipId: string, body: string) => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [body, setBody] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    if (sessionId.length === 0) {
      setInvalid("Pick the session this takeaway came from.");
      return;
    }

    if (membershipId.length === 0) {
      setInvalid("Pick the teammate who is saying it.");
      return;
    }

    const trimmed = body.trim();

    if (trimmed.length === 0) {
      setInvalid("A takeaway needs some text.");
      return;
    }

    setInvalid(null);
    setBody("");
    onAdd(sessionId, membershipId, trimmed);
  };

  return (
    <SetupPanel
      title="Add a takeaway"
      description="Anything typed here is recorded as entered in the app, not as a teammate's own email reply, so the brief can tell the two apart."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="note-session" className={fieldLabelClass}>
              Session
            </label>
            <select
              id="note-session"
              value={sessionId}
              disabled={adding}
              onChange={(event) => {
                setSessionId(event.target.value);
              }}
              className={fieldClass}
            >
              <option value="" className="bg-neutral-950">
                Choose a session
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id} className="bg-neutral-950">
                  {formatTimeRange(session.startsAt, session.endsAt, timezone)} · {session.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="note-member" className={fieldLabelClass}>
              Teammate
            </label>
            <select
              id="note-member"
              value={membershipId}
              disabled={adding}
              onChange={(event) => {
                setMembershipId(event.target.value);
              }}
              className={fieldClass}
            >
              <option value="" className="bg-neutral-950">
                Choose a teammate
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id} className="bg-neutral-950">
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="note-body" className={fieldLabelClass}>
            Takeaway
          </label>
          <textarea
            id="note-body"
            rows={3}
            value={body}
            disabled={adding}
            placeholder="What the team should remember from that room."
            onChange={(event) => {
              setBody(event.target.value);
            }}
            className={`${fieldClass} leading-relaxed`}
          />
        </div>

        {invalid !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {invalid}
          </p>
        )}
        {failure !== null && <ErrorNote message={failure} />}

        <PrimaryButton type="submit" disabled={adding}>
          <HugeiconsIcon icon={MessageAdd01Icon} size={15} />
          {adding ? "Saving…" : "Save takeaway"}
        </PrimaryButton>
      </form>
    </SetupPanel>
  );
}
