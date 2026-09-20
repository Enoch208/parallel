import { Globe02Icon, ShuffleIcon, Target02Icon, MailOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { landingImages } from "./landing-images";
import { SectionHeading } from "./section-heading";

const steps = [
  {
    icon: Globe02Icon,
    image: landingImages.tileImport,
    label: "Import",
    title: "Paste the public agenda",
    body: "Every session keeps its source URL and the time it was fetched, so any field can be traced back to the page it came from.",
  },
  {
    icon: Target02Icon,
    image: landingImages.tileIntent,
    label: "Intent",
    title: "Say what the team came to learn",
    body: "Three to six weighted goals. Each session is scored against each goal, with one line explaining the score.",
  },
  {
    icon: ShuffleIcon,
    image: landingImages.tileOptimize,
    label: "Optimize",
    title: "Split the team in one click",
    body: "A deterministic optimizer assigns people to sessions. Nobody is in two places at once, and a pinned session is never dropped.",
  },
  {
    icon: MailOpen01Icon,
    image: landingImages.tileRepair,
    label: "Repair",
    title: "Fix the plan by replying",
    body: "A teammate replies that they cannot make a session. The plan goes stale on every screen, and the repair moves the fewest people.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl scroll-mt-28 px-6 py-20">
      <SectionHeading
        eyebrow="How it works"
        title="One agenda in, one covered conference out"
        lede="AI understands the conference. Deterministic code decides who goes where."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="animate-on-scroll flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] sm:flex-row-reverse"
            style={{ animation: `fadeInUp 0.6s ease-out ${String(index * 0.08)}s both` }}
          >
            <img
              src={step.image.src}
              width={step.image.width}
              height={step.image.height}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover opacity-90 [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)] sm:aspect-square sm:h-auto sm:w-[44%] sm:shrink-0 sm:self-stretch sm:[mask-image:linear-gradient(to_left,black_50%,transparent_100%)]"
            />
            <div className="relative -mt-12 flex flex-col justify-center p-6 sm:mt-0 sm:p-7 sm:pr-0">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                  <HugeiconsIcon icon={step.icon} size={16} />
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                  {step.label}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-medium tracking-tight text-white">{step.title}</h3>
              <p className="max-w-md text-sm leading-relaxed text-neutral-300">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
