import { UnicornScene } from "./unicorn-scene";

const fadeMask = "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)";

export function BackgroundEffects() {
  return (
    <>
      <div
        className="absolute top-0 -z-10 h-[900px] w-full"
        style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
      >
        <UnicornScene projectId="bKN5upvoulAmWvInmHza" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 mx-auto max-w-7xl grid-lines border-r border-l border-white/[0.03]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--accent-glow),_transparent_70%)] opacity-50 blur-3xl" />
      </div>
    </>
  );
}
