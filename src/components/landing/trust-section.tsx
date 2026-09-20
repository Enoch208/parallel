const rules = [
  "AI never does schedule math. The optimizer is deterministic and unit tested.",
  "Every imported field keeps its source URL and fetch time.",
  "Every extracted constraint shows the exact sentence it came from.",
  "Nothing that changes someone else's day happens without their YES.",
  "Operational email never goes outside the team.",
  "Demo data is labelled as demo data.",
] as const;

export function TrustSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <div className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_both] grid gap-x-16 gap-y-8 rounded-[32px] border border-white/5 bg-white/[0.02] p-8 md:p-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <span className="mb-4 inline-block text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300/70">
            Guarantees
          </span>
          <h2 className="text-balance text-3xl font-medium leading-[1.1] tracking-tight text-white">
            Rules the product keeps, enforced in code
          </h2>
        </div>
        <ol className="flex flex-col">
          {rules.map((rule, index) => (
            <li
              key={rule}
              className="flex gap-5 border-white/5 py-4 text-sm font-light leading-relaxed text-neutral-300 first:pt-0 last:pb-0 not-last:border-b"
            >
              <span aria-hidden className="pt-0.5 font-mono text-xs text-neutral-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              {rule}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
