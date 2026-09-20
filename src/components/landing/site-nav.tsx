import type { CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router";
import { Wordmark } from "@/components/chrome/wordmark";
import { appRoutes } from "@/lib/routes";
import { landingLinks } from "./landing-links";

const bagBorder: CSSProperties & Record<"--border-gradient" | "--border-radius-before", string> = {
  "--border-gradient": "linear-gradient(to bottom, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
  "--border-radius-before": "9999px",
};

export function SiteNav() {
  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6 animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0s_both]">
      <nav className="flex w-full max-w-6xl items-center justify-between rounded-full border border-white/5 bg-[#050505]/80 p-2 pl-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
        <a
          href="#top"
          aria-label="Parallel home"
          className="inline-flex items-center justify-center h-[36px]"
        >
          <Wordmark />
        </a>

        <div className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          {landingLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="flex min-h-10 items-center transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={appRoutes.board}
            className="group relative flex min-h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-xs font-medium text-white transition-all hover:bg-neutral-800"
            style={bagBorder}
          >
            <span>Open the board</span>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
          </Link>
        </div>
      </nav>
    </div>
  );
}
