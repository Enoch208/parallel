import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { cx } from "@/lib/cx";

export type ConferenceNote = FunctionReturnType<typeof api.notes.listForConference>[number];

function formatStamp(at: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(at));
}

function SourceTag({ source }: { source: ConferenceNote["source"] }) {
  const fromEmail = source === "email";

  return (
    <span
      className={cx(
        "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-medium sm:min-h-0 sm:px-2.5",
        fromEmail
          ? "border-blue-500/30 bg-blue-950/20 text-blue-200"
          : "border-white/10 bg-white/[0.04] text-neutral-300",
      )}
    >
      <HugeiconsIcon icon={fromEmail ? Mail01Icon : PencilEdit02Icon} size={12} />
      {fromEmail ? "Email reply" : "Typed in the app"}
    </span>
  );
}

function ApprovalToggle({
  approved,
  busy,
  onChange,
}: {
  approved: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        onChange(!approved);
      }}
      className={cx(
        "flex min-h-10 shrink-0 items-center rounded-full border px-3 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 sm:min-h-0 sm:px-2.5",
        approved
          ? "border-white/10 bg-white/[0.04] text-neutral-300 hover:text-white"
          : "border-amber-500/40 bg-amber-950/20 text-amber-200",
      )}
    >
      {approved ? "In the brief" : "Held back"}
    </button>
  );
}

export function NoteList({
  notes,
  timezone,
  busyNoteId,
  onApprovalChange,
}: {
  notes: readonly ConferenceNote[];
  timezone: string;
  busyNoteId: string | null;
  onApprovalChange: (noteId: string, approved: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-white">{note.sessionTitle}</span>
              <span className="text-xs text-neutral-500">
                {note.authorName} · {formatStamp(note.at, timezone)}
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SourceTag source={note.source} />
              <ApprovalToggle
                approved={note.approved}
                busy={busyNoteId === note.id}
                onChange={(next) => {
                  onApprovalChange(note.id, next);
                }}
              />
            </div>
          </div>
          <p className="text-sm leading-relaxed font-light text-neutral-300">{note.body}</p>
          {!note.approved && (
            <p className="text-xs font-light text-amber-200/80">
              Held back, so the brief will not use this takeaway.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
