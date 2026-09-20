const goalBars = ["w-[86%]", "w-[64%]", "w-[72%]", "w-[41%]"] as const;

const teammates = 4;
const slots = 6;
const cells = Array.from({ length: teammates * slots }, (_, index) => ({
  teammate: Math.floor(index / slots),
  slot: index % slots,
}));

const sharedSlot = 3;
const sharedTeammates = [1, 2];

function isShared(cell: { teammate: number; slot: number }) {
  return cell.slot === sharedSlot && sharedTeammates.includes(cell.teammate);
}

export function GoalBarsGlyph() {
  return (
    <div aria-hidden className="flex h-full flex-col justify-between">
      {goalBars.map((width) => (
        <span key={width} className="h-1.5 w-full rounded-full bg-white/5">
          <span
            className={`block h-full rounded-full bg-gradient-to-r from-blue-500/30 to-blue-400/80 ${width}`}
          />
        </span>
      ))}
    </div>
  );
}

export function SessionGridGlyph() {
  return (
    <div aria-hidden className="grid h-full grid-cols-6 gap-1.5">
      {cells.map((cell) => (
        <span
          key={`${String(cell.teammate)}-${String(cell.slot)}`}
          className={
            (cell.teammate + cell.slot * 2) % 5 === 0
              ? "rounded-[5px] bg-white/5"
              : "rounded-[5px] bg-blue-400/50"
          }
        />
      ))}
    </div>
  );
}

export function SharedRoomGlyph() {
  return (
    <div aria-hidden className="grid h-full grid-cols-6 gap-1.5">
      {cells.map((cell) => (
        <span
          key={`${String(cell.teammate)}-${String(cell.slot)}`}
          className={
            isShared(cell)
              ? "rounded-[5px] bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.25)]"
              : "rounded-[5px] bg-white/5"
          }
        />
      ))}
    </div>
  );
}
