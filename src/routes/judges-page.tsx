import { useState } from "react";
import { useAction } from "convex/react";
import { Link } from "react-router";
import { api } from "@convex/_generated/api";
import type { JudgeRun } from "@convex/judges";
import { AppHeader } from "@/components/chrome/app-header";
import { PageHeading } from "@/components/chrome/page-heading";
import { JudgeStepList } from "@/components/judges/judge-step-list";
import { JudgeCoverCard } from "@/components/judges/judge-cover-card";
import { ReliabilityPanel } from "@/components/judges/reliability-panel";
import { errorMessage } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";
import { appRoutes } from "@/lib/routes";

export function JudgesPage() {
  const runDemo = useAction(api.judges.runDemo);
  const { remember } = useDemoConference();
  const [run, setRun] = useState<JudgeRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await runDemo({});
      setRun(result);
      remember(result.conferenceId);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppHeader title="Judges" context="One click, the whole loop" />
      <PageHeading
        title="See it work in 90 seconds"
        description="Runs the real engine on a fresh workspace of its own. Nothing here is scripted; every number below is computed as it happens."
      />

      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            void start();
          }}
          disabled={busy}
          className="w-fit rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
        >
          {busy ? "Running the loop…" : "Run the demo"}
        </button>

        {error !== null && (
          <p role="alert" className="text-sm text-amber-200">
            {error}
          </p>
        )}

        {run !== null && (
          <>
            <JudgeStepList steps={run.steps} />

            {run.coverCandidate !== null && run.coverSessionTitle !== null && (
              <JudgeCoverCard
                sessionTitle={run.coverSessionTitle}
                candidate={run.coverCandidate}
                reasons={run.coverReasons}
              />
            )}

            <Link
              to={appRoutes.board}
              className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
            >
              Open this workspace on the board
            </Link>
          </>
        )}

        <ReliabilityPanel />
      </div>
    </>
  );
}
