import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router";
import { BackgroundEffects } from "@/components/landing/background-effects";
import { BriefSection } from "@/components/landing/brief-section";
import { ClosingCta } from "@/components/landing/closing-cta";
import { CoverageSection } from "@/components/landing/coverage-section";
import { EmailLoopSection } from "@/components/landing/email-loop-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { HeroShowcase } from "@/components/landing/hero-showcase";
import { ProblemSection } from "@/components/landing/problem-section";
import { PulseDot } from "@/components/landing/pulse-dot";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { StackSection } from "@/components/landing/stack-section";
import { TrustSection } from "@/components/landing/trust-section";
import { appRoutes } from "@/lib/routes";

export function LandingPage() {
  return (
    <div id="top" className="relative min-h-screen overflow-x-hidden">
      <BackgroundEffects />
      <SiteNav />

      <main className="relative z-10 px-6 pb-12 pt-36">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.1s_both] mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-950/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <PulseDot />
            Team planning for multi-track events
          </div>

          <h1 className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.2s_both] mb-6 text-balance text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
            Send four people to a conference.
            <br />
            <span className="text-neutral-400">
              Make sure they don&rsquo;t all learn the same thing.
            </span>
          </h1>

          <p className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.3s_both] mx-auto mb-9 max-w-xl text-base font-light md:text-lg leading-relaxed text-neutral-300 tracking-tight">
            Parallel turns a public conference agenda into one coordinated team plan, and repairs it
            when real life gets in the way.
          </p>

          <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.4s_both] flex flex-col items-center justify-center gap-4">
            <Link
              to={appRoutes.board}
              className="group relative flex items-center gap-2 rounded-full bg-white text-black px-8 py-3 text-sm font-medium transition-all hover:bg-gray-200"
            >
              <span>Try the live team</span>
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>

        <HeroShowcase />
      </main>

      <StackSection />
      <ProblemSection />
      <HowItWorksSection />
      <EmailLoopSection />
      <BriefSection />
      <CoverageSection />
      <TrustSection />
      <ClosingCta />
      <SiteFooter />
    </div>
  );
}
