const markdownBudget = 16000;
const dayHeading =
  /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][a-z]+\s+\d{1,2}/g;

export function sliceForDay(markdown: string, dayMarker: string | null): string {
  if (dayMarker === null) {
    return markdown.slice(0, markdownBudget);
  }

  const start = markdown.indexOf(dayMarker);
  const from = start === -1 ? 0 : start;

  dayHeading.lastIndex = from + dayMarker.length;
  const nextDay = dayHeading.exec(markdown);
  dayHeading.lastIndex = 0;

  const boundary = nextDay === null ? markdown.length : nextDay.index;

  return markdown.slice(from, Math.min(boundary, from + markdownBudget));
}
