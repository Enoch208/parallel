const symptoms = [
  {
    title: "Everyone picks the famous talks",
    body: "Four people plan alone, three land in the same keynote, and whole tracks go unwatched.",
  },
  {
    title: "The plan dies on day one",
    body: "A customer lunch runs long, nobody tells the group, and the session that mattered goes uncovered.",
  },
  {
    title: "The notes come home in pieces",
    body: "Four notebooks, four inboxes, and nothing the people who paid for the trip can read.",
  },
] as const;

export function ProblemSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-x-16 gap-y-10 border-t border-white/5 pt-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <span className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_both] mb-4 inline-block text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300/70">
            The problem
          </span>
          <p className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.1s_both] text-balance text-2xl font-medium leading-snug tracking-tight text-white md:text-3xl">
            Teams already try to divide and conquer.{" "}
            <span className="text-neutral-500">
              They do it in spreadsheets and group chats, and it falls apart the moment the day
              does.
            </span>
          </p>
        </div>

        <ol className="flex flex-col">
          {symptoms.map((symptom, index) => (
            <li
              key={symptom.title}
              className="animate-on-scroll flex gap-6 border-white/5 py-7 first:pt-0 not-last:border-b"
              style={{ animation: `fadeInUp 0.6s ease-out ${String(index * 0.1)}s both` }}
            >
              <span aria-hidden className="pt-1 font-mono text-xs text-neutral-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="mb-2 text-lg font-medium tracking-tight text-white">
                  {symptom.title}
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-400">
                  {symptom.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
