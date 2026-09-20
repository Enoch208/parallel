import {
  DashboardSquare01Icon,
  DocumentValidationIcon,
  Note01Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { Link } from "react-router";
import { appRoutes } from "@/lib/routes";
import { SidebarSection } from "./sidebar-tree";
import { Wordmark } from "./wordmark";

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 h-full p-8 border-r border-white/5 bg-[#070707] overflow-y-auto no-scrollbar">
      <Link
        to={appRoutes.landing}
        aria-label="Parallel home"
        className="flex items-center gap-2 mb-10 pl-2"
      >
        <Wordmark />
      </Link>

      <nav className="space-y-1 flex-1">
        <SidebarSection
          label="Plan"
          href={appRoutes.board}
          icon={DashboardSquare01Icon}
          items={[{ label: "Agenda", href: appRoutes.agenda }]}
        />
        <SidebarSection label="Goals" href={appRoutes.goals} icon={Target02Icon} items={[]} />
        <SidebarSection label="Notes" href={appRoutes.notes} icon={Note01Icon} items={[]} />
        <SidebarSection
          label="Brief"
          href={appRoutes.brief}
          icon={DocumentValidationIcon}
          items={[]}
        />
      </nav>

      <div className="mt-auto pt-8 border-t border-white/5">
        <Link
          to={appRoutes.landing}
          className="flex items-center gap-3 px-3 py-2 text-neutral-500 hover:text-white transition-colors w-full"
        >
          <span className="text-sm font-medium">Back to site</span>
        </Link>
      </div>
    </aside>
  );
}
