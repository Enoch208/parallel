const fadeMask = "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)";

export function BackgroundEffects() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
    >
      <div className="absolute inset-0 mx-auto max-w-7xl grid-lines border-r border-l border-white/[0.03]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--accent-glow),_transparent_70%)] opacity-50 blur-3xl" />
    </div>
  );
}
