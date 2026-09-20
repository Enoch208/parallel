import { Link } from "react-router";
import { Wordmark } from "@/components/chrome/wordmark";
import { appRoutes } from "@/lib/routes";
import { landingLinks } from "./landing-links";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Wordmark />
          <p className="max-w-sm text-sm font-light leading-relaxed text-neutral-400">
            Parallel maximizes what a whole team learns at a conference, rather than optimizing one
            person&rsquo;s calendar.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-3 text-sm md:items-end">
          {landingLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-neutral-400 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
          <Link to={appRoutes.board} className="text-white transition-colors hover:text-blue-200">
            Open the board
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-10 max-w-6xl px-6">
        <p className="border-t border-white/5 pt-6 text-xs font-light leading-relaxed text-neutral-600">
          Agenda data comes from public conference pages and is shown with its source. Unofficial,
          and not affiliated with any event organizer. OpenAI, Firecrawl, AgentMail and Convex names
          and logos are trademarks of their respective owners, shown only to say which services
          Parallel uses. Parallel is not affiliated with, sponsored by or endorsed by them.
        </p>
      </div>
    </footer>
  );
}
