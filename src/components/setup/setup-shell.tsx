import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "The call failed and returned no message.";
}

export const fieldClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-neutral-500 focus:border-blue-500/50 disabled:opacity-60";

export const fieldLabelClass = "text-xs font-medium text-neutral-400";

export function SetupPanel({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="max-w-xl text-xs font-light leading-relaxed text-neutral-500">
            {description}
          </p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
  type?: "text" | "url" | "email";
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={fieldClass}
      />
      {hint !== undefined && (
        <span className="text-[11px] font-light text-neutral-400">{hint}</span>
      )}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs leading-relaxed text-red-200"
    >
      <HugeiconsIcon icon={Alert02Icon} size={14} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">That call failed. </span>
        {message}
      </span>
    </p>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
