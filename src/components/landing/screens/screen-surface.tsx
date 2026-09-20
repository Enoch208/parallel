import type { ReactNode } from "react";
import { screenStyle, type ScreenGeometry } from "./screen-geometry";

export function ScreenSurface({
  geometry,
  children,
}: {
  geometry: ScreenGeometry;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute overflow-hidden bg-[#08080a] [container-type:size] font-sans text-neutral-300"
      style={screenStyle(geometry)}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_12px_rgba(0,0,0,0.9)]" />
    </div>
  );
}
