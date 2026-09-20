const lanes = [
  [
    { top: 4, height: 17 },
    { top: 30, height: 22 },
    { top: 60, height: 15 },
  ],
  [
    { top: 4, height: 17 },
    { top: 26, height: 14 },
    { top: 48, height: 26 },
  ],
  [
    { top: 12, height: 22 },
    { top: 40, height: 16 },
    { top: 64, height: 20 },
  ],
  [
    { top: 4, height: 13 },
    { top: 34, height: 25 },
    { top: 68, height: 14 },
  ],
] as const;

export function BoardPreview() {
  return (
    <div className="absolute inset-0 flex flex-col gap-[3cqh] p-[4cqw]">
      <div className="flex items-center gap-[1.5cqw]">
        <span className="h-[1.6cqh] w-[12cqw] rounded-full bg-white/25" />
        <span className="h-[1.6cqh] w-[6cqw] rounded-full bg-white/10" />
        <span className="ml-auto h-[3cqh] w-[14cqw] rounded-full bg-blue-500/70" />
      </div>
      <div className="grid flex-1 grid-cols-4 gap-[2cqw]">
        {lanes.map((lane, laneIndex) => (
          <div key={laneIndex} className="relative rounded-[1cqw] bg-white/[0.03]">
            <span className="absolute inset-x-[15%] top-[1.5cqh] h-[1.2cqh] rounded-full bg-white/15" />
            {lane.map((card) => (
              <span
                key={card.top}
                className="absolute inset-x-[8%] rounded-[0.8cqw] bg-white/10 ring-1 ring-white/10"
                style={{ top: `${String(card.top + 8)}%`, height: `${String(card.height)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
