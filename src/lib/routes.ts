export const appRoutes = {
  landing: "/",
  board: "/board",
  agenda: "/agenda",
  goals: "/goals",
  notes: "/notes",
  brief: "/brief",
} as const;

export type AppHref = (typeof appRoutes)[keyof typeof appRoutes];

export function isActiveRoute(pathname: string, route: string, exact: boolean): boolean {
  return exact ? pathname === route : pathname === route || pathname.startsWith(`${route}/`);
}
