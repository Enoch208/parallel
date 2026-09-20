import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon, Copy01Icon } from "@hugeicons/core-free-icons";

type CopyState = "idle" | "copied" | "failed";

export function EvidenceEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-6">
      <span className="text-sm font-medium text-white">{title}</span>
      <p className="text-xs leading-relaxed font-light text-neutral-500">{description}</p>
    </div>
  );
}

export function Flag({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
      <HugeiconsIcon icon={Alert02Icon} size={11} className="shrink-0" />
      {children}
    </span>
  );
}

export function Quoted({ text }: { text: string }) {
  return (
    <blockquote className="border-l-2 border-blue-500/40 pl-3 text-sm leading-relaxed text-neutral-200 italic">
      &ldquo;{text}&rdquo;
    </blockquote>
  );
}

function shorten(value: string): string {
  return value.length <= 22 ? value : `${value.slice(0, 14)}…${value.slice(-6)}`;
}

export function CopyableHash({ value, describedBy }: { value: string; describedBy: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const copy = () => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setState("copied");
      },
      () => {
        setState("failed");
      },
    );
  };

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <code title={value} className="max-w-full font-mono text-[11px] break-all text-neutral-400">
        {shorten(value)}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the full content hash for ${describedBy}`}
        className="flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-white/5 bg-white/[0.03] px-2 text-[10px] font-medium text-neutral-400 transition-colors hover:text-white md:min-h-8 md:min-w-8"
      >
        <HugeiconsIcon
          icon={state === "copied" ? CheckmarkCircle02Icon : Copy01Icon}
          size={13}
          className="shrink-0"
        />
      </button>
      {state !== "idle" && (
        <span role="status" className="text-[10px] font-medium text-neutral-400">
          {state === "copied" ? "Copied in full" : "Copy blocked by the browser"}
        </span>
      )}
    </span>
  );
}
