import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { JudgeEmail, JudgeEmailStatus } from "@convex/judgeEmail";
import { appRoutes } from "@/lib/routes";

function CopyField({ label, value }: { label: string; value: string }) {
  const [note, setNote] = useState<string | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setNote("Copied");
      },
      () => {
        setNote("Copy failed; select the text instead");
      },
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wider text-neutral-500 uppercase">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <code className="min-w-0 rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs break-all text-neutral-200 select-all">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.06]"
        >
          Copy {label.toLowerCase()}
        </button>
        {note !== null && <span className="text-[11px] text-neutral-400">{note}</span>}
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: JudgeEmailStatus | undefined }) {
  if (status === undefined || status.state === "waiting") {
    return <>Waiting for your email. It usually arrives within a minute.</>;
  }

  if (status.state === "reading") {
    return <>Received. Reading it now.</>;
  }

  if (status.state === "applied") {
    return (
      <>
        Plan changed: it is stale on the board now.{" "}
        <Link to={appRoutes.board} className="text-white underline underline-offset-4">
          Open the board and press Repair
        </Link>
      </>
    );
  }

  if (status.state === "unplaced") {
    return (
      <>
        Read, but Parallel could not tell which session you meant
        {status.detail === null ? "" : ` (${status.detail})`}. Nothing changed.{" "}
        <Link to={appRoutes.evidence} className="text-white underline underline-offset-4">
          Open Evidence
        </Link>
      </>
    );
  }

  if (status.state === "failed") {
    return <>{status.detail ?? "Parallel could not read that email."}</>;
  }

  return <>This demo's email code has expired. Run the demo again for a new one.</>;
}

export function JudgeEmailCard({
  conferenceId,
  email,
}: {
  conferenceId: Id<"conferences">;
  email: JudgeEmail;
}) {
  const status = useQuery(api.judgeEmail.judgeEmailStatus, { conferenceId });
  const mailto = `mailto:${email.address}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  const hours = email.expiresInMinutes / 60;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-blue-500/25 bg-blue-950/15 p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium text-white">Try it with your own email</h3>
        <p className="max-w-2xl text-xs leading-relaxed text-neutral-400">
          Send this from any inbox. It makes {email.memberName} unavailable for &ldquo;
          {email.sessionTitle}&rdquo; in this demo workspace only. The code in the subject works for
          one change, for {String(hours)} hours, and Parallel never emails you back.
        </p>
      </div>

      <a
        href={mailto}
        className="w-fit rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
      >
        Open in my email app
      </a>

      <div className="flex flex-col gap-3">
        <CopyField label="Address" value={email.address} />
        <CopyField label="Subject" value={email.subject} />
        <CopyField label="Message" value={email.body} />
      </div>

      <p role="status" aria-live="polite" className="text-sm leading-relaxed text-neutral-200">
        <StatusLine status={status} />
      </p>
    </section>
  );
}
