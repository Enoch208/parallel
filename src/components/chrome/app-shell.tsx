import type { ReactNode } from "react";
import { AppMobileNav } from "./app-mobile-nav";
import { AppScrollArea } from "./app-scroll-area";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen bg-[#020202] p-3 lg:p-8 flex justify-center">
      <div className="bg-[#070707] w-full max-w-[1500px] lg:h-full rounded-[28px] lg:rounded-[40px] shadow-2xl shadow-black/50 overflow-hidden flex flex-col lg:flex-row relative border border-white/5">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 lg:h-full bg-[#070707]">
          <AppMobileNav />
          <AppScrollArea>{children}</AppScrollArea>
        </main>
      </div>
    </div>
  );
}
