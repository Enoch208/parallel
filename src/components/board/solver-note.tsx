export function SolverNote({
  solverStatus,
  objective,
  upperBound,
}: {
  solverStatus: "optimal" | "heuristic" | null;
  objective: number | null;
  upperBound: number | null;
}) {
  if (solverStatus === null) {
    return null;
  }

  if (solverStatus === "optimal") {
    return (
      <p className="text-xs font-light leading-relaxed text-neutral-400">
        <span className="font-medium text-white">Proven optimal.</span> The solver searched the
        whole space for this team and this agenda; no other split scores higher.
      </p>
    );
  }

  const gap =
    objective === null || upperBound === null ? null : Math.max(0, upperBound - objective);

  return (
    <p className="text-xs font-light leading-relaxed text-neutral-400">
      <span className="font-medium text-white">Best found, not proven optimal.</span> This agenda is
      large enough that the search was cut short
      {gap === null
        ? ""
        : `, so the best possible split could be up to ${gap.toFixed(1)} points better`}
      . The figure shown is what this plan actually scores, never an estimate.
    </p>
  );
}
