import { Link } from "react-router";
import { appRoutes } from "@/lib/routes";

export function AppHeader({ title, context }: { title: string; context: string }) {
  return (
    <header className="flex flex-col md:flex-row md:items-center gap-4 px-5 pt-6 pb-6 lg:px-8 lg:pt-8 justify-between">
      <div className="flex items-center gap-4">
        <span className="text-3xl lg:text-4xl font-medium text-white tracking-tight">{title}</span>
        <div className="h-8 w-px bg-white/10 mx-2" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">{context}</span>
          <span className="text-xs text-neutral-500">Team plan · live</span>
        </div>
      </div>

      <div className="bg-white/[0.04] p-1 rounded-full flex items-center self-start md:self-center border border-white/5">
        <span className="px-5 py-1.5 bg-white/10 rounded-full text-xs font-medium text-white">
          App
        </span>
        <Link
          to={appRoutes.landing}
          className="px-5 py-1.5 text-xs font-medium text-neutral-500 hover:text-white transition-colors"
        >
          Site
        </Link>
      </div>
    </header>
  );
}
