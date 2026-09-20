export function formatTimeRange(startsAt: number, endsAt: number, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

export function formatDuration(startsAt: number, endsAt: number): string {
  const minutes = Math.round((endsAt - startsAt) / 60000);
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
}
