import parallelMark from "@/assets/brand/parallel-mark.webp";

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
      <img
        src={parallelMark}
        alt=""
        aria-hidden
        width={320}
        height={218}
        decoding="async"
        className="h-[18px] w-auto"
      />
      Parallel
    </span>
  );
}
