import agentmailLogo from "@/assets/sponsors/agentmail-wordmark.webp";
import convexLogo from "@/assets/sponsors/convex.svg";
import firecrawlLogo from "@/assets/sponsors/firecrawl.svg";
import openaiLogo from "@/assets/sponsors/openai-wordmark.svg";

const services = [
  {
    name: "Firecrawl",
    logo: firecrawlLogo,
    logoClassName: "h-6",
    role: "Reads the public agenda page into sessions that keep their source.",
  },
  {
    name: "OpenAI",
    logo: openaiLogo,
    logoClassName: "-ml-4 h-12",
    role: "Scores sessions against goals, parses replies and writes the brief.",
  },
  {
    name: "AgentMail",
    logo: agentmailLogo,
    logoClassName: "h-6",
    role: "Carries the plan to teammates and brings their replies back.",
  },
  {
    name: "Convex",
    logo: convexLogo,
    logoClassName: "h-[18px]",
    role: "Holds the one live plan that every screen sees at the same moment.",
  },
] as const;

export function StackSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-4">
      <p className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_both] mb-6 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">
        What runs it
      </p>
      <ul className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.1s_both] grid overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <li
            key={service.name}
            className="flex flex-col gap-4 border-white/5 p-6 not-last:border-b sm:odd:border-r lg:border-b-0 lg:not-last:border-r"
          >
            <span className="flex h-12 items-center">
              <img
                src={service.logo}
                alt={service.name}
                loading="lazy"
                decoding="async"
                className={`w-auto ${service.logoClassName}`}
              />
            </span>
            <p className="text-xs font-light leading-relaxed text-neutral-500">{service.role}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
