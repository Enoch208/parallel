import type { SessionSummary } from "@convex/model/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { formatTimeRange } from "@/lib/format-time";

function lowConfidenceFields(session: SessionSummary): readonly string[] {
  const flags: string[] = [];

  if (session.titleConfidence === "low") flags.push("Title needs checking");
  if (session.timeConfidence === "low") flags.push("Time needs checking");
  if (session.roomConfidence === "low") flags.push("Room needs checking");

  return flags;
}

function SessionRow({ session, timezone }: { session: SessionSummary; timezone: string }) {
  const flags = lowConfidenceFields(session);
  const meta = [session.track, session.room, session.speakers.join(", ")].filter(
    (value): value is string => value !== null && value.length > 0,
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:flex-row md:items-start">
      <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-400 md:w-28">
        {formatTimeRange(session.startsAt, session.endsAt, timezone)}
      </span>

      <div className="flex flex-1 flex-col gap-1.5">
        <h4 className="text-sm font-medium leading-snug text-white">{session.title}</h4>
        {meta.length > 0 && (
          <p className="text-xs font-light text-neutral-500">{meta.join(" · ")}</p>
        )}
        {flags.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-0.5">
            {flags.map((flag) => (
              <li
                key={flag}
                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200"
              >
                {flag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={session.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-neutral-500 transition-colors hover:text-white"
      >
        Source
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} />
      </a>
    </li>
  );
}

export function SessionList({
  sessions,
  timezone,
}: {
  sessions: readonly SessionSummary[];
  timezone: string;
}) {
  const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });

  const days: { day: string; sessions: SessionSummary[] }[] = [];

  for (const session of sessions) {
    const day = dayFormatter.format(new Date(session.startsAt));
    const current = days.at(-1);

    if (current !== undefined && current.day === day) {
      current.sessions.push(session);
    } else {
      days.push({ day, sessions: [session] });
    }
  }

  const needChecking = sessions.filter((session) => lowConfidenceFields(session).length > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-light text-neutral-500">
        {sessions.length} imported {sessions.length === 1 ? "session" : "sessions"}, times shown in{" "}
        {timezone}.{" "}
        {needChecking === 0
          ? "Every field came back with high confidence."
          : `${String(needChecking)} carry a field the extraction was unsure about, marked on the session.`}
      </p>

      {days.map((group) => (
        <section key={group.day} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            {group.day}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.sessions.map((session) => (
              <SessionRow key={session.id} session={session} timezone={timezone} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
