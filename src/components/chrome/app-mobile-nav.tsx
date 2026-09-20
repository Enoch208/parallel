import { Link, useLocation } from "react-router";
import { cx } from "@/lib/cx";
import { appRoutes, isActiveRoute } from "@/lib/routes";

const items = [
  { label: "Board", href: appRoutes.board, exact: true },
  { label: "Agenda", href: appRoutes.agenda, exact: true },
  { label: "Goals", href: appRoutes.goals, exact: true },
  { label: "Notes", href: appRoutes.notes, exact: true },
  { label: "Brief", href: appRoutes.brief, exact: true },
] as const;

export function AppMobileNav() {
  const { pathname } = useLocation();

  return (
    <nav className="lg:hidden sticky top-0 z-30 flex gap-2 overflow-x-auto no-scrollbar border-y border-white/5 bg-[#070707]/95 px-5 py-3 backdrop-blur-md">
      {items.map((item) => {
        const active = isActiveRoute(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-black" : "bg-white/[0.04] text-neutral-400 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
