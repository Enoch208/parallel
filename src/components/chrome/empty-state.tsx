import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-20 text-center">
      <span className="text-lg font-medium text-white">{title}</span>
      <p className="max-w-md text-sm text-neutral-500">{description}</p>
      {action}
    </div>
  );
}
