import type { TimeWindow } from "../model/types";
import { itemAt } from "./lookup";

function byEndThenStart(left: TimeWindow, right: TimeWindow): number {
  if (left.endsAt !== right.endsAt) return left.endsAt - right.endsAt;
  return left.startsAt - right.startsAt;
}

function latestTrackFreeBy(freeFrom: readonly number[], startsAt: number): number {
  let low = 0;
  let high = freeFrom.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (itemAt(freeFrom, middle) <= startsAt) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export function maxAttendableIntervals(
  intervals: readonly TimeWindow[],
  attendeeCount: number,
): number {
  const trackCount = Math.min(Math.max(0, attendeeCount), intervals.length);
  if (trackCount === 0) return 0;
  const freeFrom = new Array<number>(trackCount).fill(Number.NEGATIVE_INFINITY);
  let attended = 0;
  for (const interval of [...intervals].sort(byEndThenStart)) {
    const track = latestTrackFreeBy(freeFrom, interval.startsAt);
    if (track < 0) continue;
    freeFrom.splice(track, 1);
    freeFrom.push(interval.endsAt);
    attended += 1;
  }
  return attended;
}
