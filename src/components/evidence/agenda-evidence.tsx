import type { SessionProvenance } from "@convex/evidence";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { formatTimeRange } from "@/lib/format-time";
import { CopyableHash, EvidenceEmpty, Flag } from "./evidence-primitives";

function stamp(at: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(at));
}

function flagsFor(session: SessionProvenance): readonly string[] {
  const flags: string[] = [];
  if (session.titleConfidence === "low") flags.push("Title: low confidence");
  if (session.timeConfidence === "low") flags.push("Time: low confidence");
  if (session.roomConfidence === "low") flags.push("Room: low confidence");
  return flags;
}

function SessionEvidenceRow({
  session,
  timezone,
}: {
  session: SessionProvenance;
  timezone: string;
}) {
  const flags = flagsFor(session);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-sm leading-snug font-medium break-words text-white">{session.title}</h4>
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">
          {formatTimeRange(session.startsAt, session.endsAt, timezone)}
        </span>
      </div>

      {flags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {flags.map((flag) => (
            <li key={flag}>
              <Flag>{flag}</Flag>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[11px] font-light text-neutral-500">
          Title, time and room all came back high confidence.
        </span>
      )}

      {session.source === null ? (
        <span className="text-[11px] text-amber-200">
          The source row for this session is missing from the database.
        </span>
      ) : (
        <dl className="flex min-w-0 flex-col gap-2 border-t border-white/5 pt-3 text-[11px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="font-medium text-neutral-400">Imported from</dt>
            <dd className="min-w-0">
              <a
                href={session.source.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 items-center gap-1 break-all text-blue-300 underline underline-offset-2 transition-colors hover:text-blue-200 md:min-h-0"
              >
                {session.source.url}
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} className="shrink-0" />
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-neutral-400">Fetched</dt>
            <dd className="font-mono tabular-nums text-neutral-300">
              {stamp(session.source.fetchedAt, timezone)}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="font-medium text-neutral-400">Content hash of that fetch</dt>
            <dd className="min-w-0">
              <CopyableHash value={session.source.contentHash} describedBy={session.title} />
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

export function AgendaEvidence({
  sessions,
  timezone,
}: {
  sessions: readonly SessionProvenance[];
  timezone: string;
}) {
  if (sessions.length === 0) {
    return (
      <EvidenceEmpty
        title="No sessions imported yet"
        description="Nothing has been scraped into this conference, so there is no source URL, fetch time or content hash to audit. Import a public agenda on the Agenda screen."
      />
    );
  }

  return (
    <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
      {sessions.map((session) => (
        <SessionEvidenceRow key={session.sessionId} session={session} timezone={timezone} />
      ))}
    </ul>
  );
}
