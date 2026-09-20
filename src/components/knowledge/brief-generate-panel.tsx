import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import type { GenerateBriefResult } from "@convex/brief";
import { ErrorNote, PrimaryButton, SetupPanel, TextField } from "@/components/setup/setup-shell";
import { BriefRunReport } from "./brief-run-report";

export function BriefGeneratePanel({
  costLabel,
  generating,
  failure,
  result,
  blocked,
  onGenerate,
}: {
  costLabel: string;
  generating: boolean;
  failure: string | null;
  result: GenerateBriefResult | null;
  blocked: string | null;
  onGenerate: (tripCostEstimate: number | null) => void;
}) {
  const [cost, setCost] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const trimmed = cost.trim();

    if (trimmed.length === 0) {
      setInvalid(null);
      onGenerate(null);
      return;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setInvalid("The trip cost estimate must be a number that is not negative, or left blank.");
      return;
    }

    setInvalid(null);
    onGenerate(parsed);
  };

  return (
    <SetupPanel
      title="Write the brief"
      description="One model pass over the team's takeaways, grouped by goal. Every claim must name a takeaway it came from; anything that cannot is dropped and counted below rather than kept."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          id="brief-trip-cost"
          label="Trip cost estimate"
          value={cost}
          onChange={setCost}
          disabled={generating}
          placeholder="Leave blank if you would rather not say"
          hint={costLabel}
        />

        {invalid !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {invalid}
          </p>
        )}
        {blocked !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {blocked}
          </p>
        )}
        {failure !== null && <ErrorNote message={failure} />}

        <PrimaryButton type="submit" disabled={generating || blocked !== null}>
          <HugeiconsIcon icon={SparklesIcon} size={15} />
          {generating ? "Writing…" : "Write the brief"}
        </PrimaryButton>
      </form>

      {result !== null && <BriefRunReport result={result} />}
    </SetupPanel>
  );
}
