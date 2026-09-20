export function JudgeCoverCard({
  sessionTitle,
  candidate,
  reasons,
}: {
  sessionTitle: string;
  candidate: string;
  reasons: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/25 bg-blue-950/15 p-5">
      <span className="text-sm font-medium text-white">
        5. {candidate} is asked to cover &ldquo;{sessionTitle}&rdquo;
      </span>
      <ul className="flex flex-col gap-1.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-xs font-light text-neutral-400">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
            {reason}
          </li>
        ))}
      </ul>
      <p className="text-xs font-light text-neutral-500">
        Every line comes from the optimizer&rsquo;s own score terms. Nobody is moved until they
        answer.
      </p>
    </div>
  );
}
