import { Link } from "react-router";
import { appRoutes } from "@/lib/routes";

export function AppHeader({ title, context }: { title: string; context: string }) {
  return (
    <header className="flex flex-col md:flex-row md:items-center gap-4 px-5 pt-6 pb-6 lg:px-8 lg:pt-8 justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="text-3xl lg:text-4xl font-medium text-white tracking-tight">{title}</span>
        <div className="h-8 w-px shrink-0 bg-white/10 mx-2" />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium break-words text-white">{context}</span>
          <span className="text-xs text-neutral-500">Team plan · live</span>
        </div>
      </div>

      <div className="bg-white/[0.04] p-1 rounded-full flex items-center self-start md:self-center border border-white/5">
        <span className="flex min-h-10 items-center px-5 bg-white/10 rounded-full text-xs font-medium text-white md:min-h-0 md:py-1.5">
          App
        </span>
        <Link
          to={appRoutes.landing}
          className="flex min-h-10 items-center px-5 text-xs font-medium text-neutral-400 hover:text-white transition-colors md:min-h-0 md:py-1.5"
        >
          Site
        </Link>
      </div>
    </header>
  );
}
