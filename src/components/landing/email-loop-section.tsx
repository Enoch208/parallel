import { HugeiconsIcon } from "@hugeicons/react";
import { InboxIcon, SentIcon } from "@hugeicons/core-free-icons";
import { PhoneShowcase } from "./phone-showcase";
import { SectionHeading } from "./section-heading";

const exchanges = [
  {
    direction: "out" as const,
    label: "Parallel sends",
    body: "Your sessions today, the room for each, and one line on why you were assigned it.",
  },
  {
    direction: "in" as const,
    label: "Drey replies",
    body: "Can't make the 2pm, customer lunch.",
  },
  {
    direction: "out" as const,
    label: "Parallel asks Maya",
    body: "You are the best replacement: no conflict, and it restores most of the team's evaluation gap. Reply YES to take it.",
  },
  {
    direction: "in" as const,
    label: "Maya replies",
    body: "YES",
  },
] as const;

export function EmailLoopSection() {
  return (
    <section id="email-loop" className="relative z-10 mx-auto max-w-6xl scroll-mt-28 px-6 py-20">
      <SectionHeading
        eyebrow="The email loop"
        title="Teammates never have to open the app"
        lede="The plan arrives by email. Changes and takeaways come back as ordinary replies, written however people write."
      />

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PhoneShowcase />

        <div className="flex flex-col gap-3">
          {exchanges.map((exchange, index) => {
            const outbound = exchange.direction === "out";
            return (
              <div
                key={exchange.label}
                className={`animate-on-scroll flex max-w-[85%] flex-col gap-2 rounded-3xl border p-5 ${
                  outbound
                    ? "self-start border-white/5 bg-white/[0.03]"
                    : "self-end border-blue-500/20 bg-blue-950/20"
                }`}
                style={{ animation: `fadeInUp 0.6s ease-out ${String(index * 0.1)}s both` }}
              >
                <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  <HugeiconsIcon icon={outbound ? SentIcon : InboxIcon} size={12} />
                  {exchange.label}
                </span>
                <p
                  className={`text-sm font-light leading-relaxed ${outbound ? "text-neutral-300" : "text-blue-100"}`}
                >
                  {exchange.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.4s_both] mt-10 max-w-2xl border-l border-blue-500/30 pl-5 text-sm font-light leading-relaxed text-neutral-500">
        A teammate&rsquo;s own &ldquo;can&rsquo;t make it&rdquo; applies immediately, with an undo
        link. Anything that changes someone else&rsquo;s day waits for their YES.
      </p>
    </section>
  );
}
