import type { RelevanceSample } from "@convex/evidence";
import { EvidenceEmpty } from "./evidence-primitives";

export function ModelEvidence({ scores }: { scores: RelevanceSample }) {
  if (scores.totalScores === 0) {
    return (
      <EvidenceEmpty
        title="No relevance scores stored"
        description="No session has been scored against a goal on this conference, so the model has contributed nothing to the plan yet."
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-[11px] leading-relaxed font-light text-neutral-500">
        Showing the {String(scores.sample.length)} highest-scoring of{" "}
        <span className="font-mono tabular-nums text-neutral-300">
          {String(scores.totalScores)}
        </span>{" "}
        stored session-and-goal pairs. Every row below is read back from the database exactly as the
        scoring step wrote it.
      </p>

      <ul className="flex min-w-0 flex-col gap-2">
        {scores.sample.map((score) => (
          <li
            key={score.scoreId}
            className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:flex-row md:items-start md:gap-4"
          >
            <span className="shrink-0 font-mono text-lg font-light tabular-nums text-white md:w-16">
              {score.relevance.toFixed(2)}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm leading-snug font-medium break-words text-white">
                {score.sessionTitle}
              </span>
              <span className="text-xs font-light break-words text-neutral-400">
                Scored against the goal &ldquo;{score.goalLabel}&rdquo;
              </span>
              <p className="text-xs leading-relaxed break-words text-neutral-300">{score.reason}</p>
              <span className="w-fit rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] break-all text-neutral-400">
                {score.model}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-neutral-400">
        <span className="font-medium text-white">
          These scores are advisory input, not a plan.{" "}
        </span>
        The model reads a session and a goal and returns a relevance number with the sentence of
        reasoning above. It never decides who attends what. Every assignment on this page was chosen
        by the deterministic optimizer, which reads these numbers alongside pins, blocks and
        overlaps and produces the same plan every time it is given the same input.
      </p>
    </div>
  );
}
