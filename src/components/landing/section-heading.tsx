export function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="mb-12 grid gap-x-12 gap-y-5 border-t border-white/5 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
      <div>
        <span className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_both] mb-4 inline-block text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300/70">
          {eyebrow}
        </span>
        <h2 className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.1s_both] max-w-xl text-balance text-3xl font-medium leading-[1.1] tracking-tight text-white md:text-[2.5rem]">
          {title}
        </h2>
      </div>
      <p className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.2s_both] max-w-md text-base font-light leading-relaxed text-neutral-300 lg:justify-self-end">
        {lede}
      </p>
    </div>
  );
}
