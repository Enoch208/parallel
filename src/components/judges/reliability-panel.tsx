import { useState } from "react";
import { useAction } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { api } from "@convex/_generated/api";
import type { ReliabilityProof } from "@convex/reliability";
import { errorMessage } from "@/components/setup/setup-shell";

const repositoryTests = "https://github.com/Enoch208/parallel/blob/main/tests/engine/exact.test.ts";

function ProofRow({ proof }: { proof: ReliabilityProof }) {
  return (
    <li className="flex min-w-0 gap-3 border-b border-white/5 py-4 last:border-b-0">
      <HugeiconsIcon
        icon={proof.passed ? CheckmarkCircle02Icon : CancelCircleIcon}
        size={18}
        className={proof.passed ? "mt-0.5 shrink-0 text-blue-400" : "mt-0.5 shrink-0 text-red-300"}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-white">{proof.name}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {proof.passed ? "Held" : "Failed"} · {proof.durationMs} ms
          </span>
        </div>
        <p className="text-sm text-neutral-300">{proof.claim}</p>
        <p className="text-xs leading-relaxed text-neutral-500">{proof.detail}</p>
      </div>
    </li>
  );
}

export function ReliabilityPanel() {
  const runProofs = useAction(api.reliability.runReliabilityProofs);
  const [proofs, setProofs] = useState<readonly ReliabilityProof[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);

    try {
      setProofs(await runProofs({}));
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  const held = proofs === null ? 0 : proofs.filter((proof) => proof.passed).length;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium tracking-tight text-white">Try to break it</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Each check attacks the production code path on a throwaway workspace, then deletes it.
          Nothing is replayed from a recording and nothing is mocked.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          void run();
        }}
        disabled={busy}
        className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-60"
      >
        {busy ? "Attacking the guards…" : proofs === null ? "Run the attacks" : "Run them again"}
      </button>

      {error !== null && (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      )}

      {proofs !== null && (
        <>
          <p role="status" className="text-sm text-neutral-300">
            {held} of {proofs.length} guards held.
          </p>
          <ul className="flex flex-col">
            {proofs.map((proof) => (
              <ProofRow key={proof.name} proof={proof} />
            ))}
          </ul>
        </>
      )}

      <p className="border-t border-white/5 pt-4 text-xs leading-relaxed text-neutral-500">
        Not run live: the exact solver is checked against brute force on every commit, because the
        brute force search is too slow to belong in production.{" "}
        <a
          href={repositoryTests}
          target="_blank"
          rel="noreferrer"
          className="text-neutral-300 underline decoration-white/20 underline-offset-2 hover:text-white"
        >
          Read the test
        </a>
        .
      </p>
    </section>
  );
}
