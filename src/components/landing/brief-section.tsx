import { landingImages } from "./landing-images";

export function BriefSection() {
  return (
    <section
      id="shared-brief"
      aria-labelledby="shared-brief-title"
      className="relative z-10 mx-auto max-w-6xl scroll-mt-28 px-6 py-20"
    >
      <div className="grid items-center gap-12 border-t border-white/10 pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <div>
          <span className="mb-5 inline-block text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300">
            Bring the knowledge home
          </span>
          <h2
            id="shared-brief-title"
            className="max-w-md text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white md:text-[2.5rem]"
          >
            Four perspectives.
            <br />
            <span className="text-neutral-400">One shared brief.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-300">
            The trip should come home as something the whole company can use. One place for what the
            team learned, why it matters, and where it came from.
          </p>
          <dl className="mt-9 space-y-6 border-l border-blue-500/30 pl-5">
            <div>
              <dt className="text-sm font-medium text-white">Organized around your goals</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                Bring related takeaways together across teammates and sessions.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-white">A source behind every finding</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                Trace each claim back to the approved notes that support it.
              </dd>
            </div>
          </dl>
        </div>
        <img
          src={landingImages.sharedBrief.src}
          width={landingImages.sharedBrief.width}
          height={landingImages.sharedBrief.height}
          alt="Four conference badges gathered around one shared report."
          loading="lazy"
          decoding="async"
          className="mx-auto aspect-square w-full max-w-[520px] object-contain [mask-image:radial-gradient(closest-side,black_62%,transparent_100%)]"
        />
      </div>
    </section>
  );
}
