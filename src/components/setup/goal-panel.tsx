import { useState } from "react";
import type { GoalSummary } from "@convex/model/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import {
  ErrorNote,
  PrimaryButton,
  SetupPanel,
  TextField,
  fieldClass,
  fieldLabelClass,
} from "./setup-shell";

const weights = [1, 2, 3, 4, 5] as const;

export function GoalPanel({
  goals,
  adding,
  failure,
  onAdd,
}: {
  goals: readonly GoalSummary[];
  adding: boolean;
  failure: string | null;
  onAdd: (label: string, weight: number) => void;
}) {
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState(3);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const trimmed = label.trim();

    if (trimmed.length === 0) {
      setInvalid("A goal needs a label the team would recognise.");
      return;
    }

    if (!Number.isInteger(weight) || weight < 1 || weight > 5) {
      setInvalid("Weight must be a whole number from 1 to 5.");
      return;
    }

    setInvalid(null);
    setLabel("");
    onAdd(trimmed, weight);
  };

  return (
    <SetupPanel
      title="What the team came to learn"
      description="Weights say which goals matter most when the optimizer splits the team. Every session is scored against every goal, and the weighted result is Team Goal Coverage."
    >
      {goals.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-xs text-neutral-400">
          No goals on this conference yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <span className="text-sm text-white">{goal.label}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-neutral-300">
                weight {goal.weight}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-4 border-t border-white/5 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <TextField
            id="goal-label"
            label="New goal"
            value={label}
            onChange={setLabel}
            disabled={adding}
            hint="Short and specific, the way the team would say it out loud."
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="goal-weight" className={fieldLabelClass}>
              Weight
            </label>
            <select
              id="goal-weight"
              value={weight}
              disabled={adding}
              onChange={(event) => {
                setWeight(Number(event.target.value));
              }}
              className={fieldClass}
            >
              {weights.map((value) => (
                <option key={value} value={value} className="bg-neutral-950">
                  {value}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-light text-neutral-400">
              1 is nice, 5 is why we came.
            </span>
          </div>
        </div>

        {invalid !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {invalid}
          </p>
        )}
        {failure !== null && <ErrorNote message={failure} />}

        <PrimaryButton type="submit" disabled={adding}>
          <HugeiconsIcon icon={Add01Icon} size={15} />
          {adding ? "Adding…" : "Add goal"}
        </PrimaryButton>
      </form>
    </SetupPanel>
  );
}
