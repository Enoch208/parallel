import { Fragment } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";

const steps = [
  { name: "Firecrawl", role: "scrapes the public agenda page, keeping its source" },
  { name: "OpenAI", role: "turns it into sessions, scores them, reads replies, writes the brief" },
  { name: "Convex", role: "runs the optimizer, keeps every screen live, refuses stale writes" },
  { name: "AgentMail", role: "emails each plan out and brings the replies back" },
] as const;

export function SponsorFlow() {
  return (
    <section
      aria-label="What each service does"
      className="flex flex-col items-stretch gap-2 lg:flex-row"
    >
      {steps.map((step, index) => (
        <Fragment key={step.name}>
          {index > 0 && (
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              size={16}
              className="shrink-0 rotate-90 self-center text-neutral-600 lg:rotate-0"
              aria-hidden="true"
            />
          )}
          <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
            <span className="text-sm font-medium text-white">{step.name}</span>
            <span className="text-xs text-neutral-400">{step.role}</span>
          </div>
        </Fragment>
      ))}
    </section>
  );
}
