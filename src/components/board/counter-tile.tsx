import { cx } from "@/lib/cx";

export function CounterTile({
  label,
  value,
  caption,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  caption: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-2xl border p-5",
        emphasis ? "border-blue-500/25 bg-blue-950/15" : "border-white/5 bg-white/[0.02]",
      )}
    >
      <span
        className={cx(
          "font-mono text-3xl font-light tabular-nums",
          value === null ? "text-neutral-700" : "text-white",
        )}
      >
        {value === null ? "—" : value}
      </span>
      <span className="text-xs font-medium text-white">{label}</span>
      <span className="text-[11px] font-light leading-relaxed text-neutral-500">{caption}</span>
    </div>
  );
}
