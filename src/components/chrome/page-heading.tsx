import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3 mt-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium text-white tracking-tight">{title}</h2>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      {aside}
    </div>
  );
}
