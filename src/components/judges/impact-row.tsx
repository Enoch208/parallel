import type { VerifiedRun } from "@convex/verifiedRun";

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function facts(run: VerifiedRun): string[] {
  const lines = [
    `${String(run.sessionsCovered)} of ${String(run.sessionsAvailable)} sessions covered`,
  ];

  if (run.peopleMovedByRepair !== null) {
    lines.push(`Repair moved ${plural(run.peopleMovedByRepair, "person", "people")}`);
  }

  if (run.takeaways > 0) {
    lines.push(plural(run.takeaways, "takeaway by email", "takeaways by email"));
  }

  if (run.briefDelivered) {
    lines.push("Brief delivered through AgentMail");
  }

  return lines;
}

export function ImpactRow({ run }: { run: VerifiedRun }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-blue-500/25 bg-blue-950/15 p-5 sm:p-6">
      <span className="text-[10px] font-medium tracking-wider text-blue-300 uppercase">
        On the verified production run · {run.name}
      </span>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-4xl font-light text-white tabular-nums sm:text-5xl">
          {String(run.coverageBefore)} → {String(run.coverageAfter)}
        </span>
        <span className="text-sm font-medium text-white">Team Goal Coverage</span>
      </div>

      <p className="max-w-2xl text-xs leading-relaxed text-neutral-400">
        {String(run.coverageBefore)} is computed, not observed: the same teammates, each attending
        only the sessions they marked for themselves. {String(run.coverageAfter)} is the plan
        Parallel coordinated. Both are read live from the stored run, on a 0 to 100 scale.
      </p>

      <ul className="flex flex-wrap gap-2">
        {facts(run).map((line) => (
          <li
            key={line}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-neutral-200"
          >
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
