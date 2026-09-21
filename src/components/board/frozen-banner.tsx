import { Link } from "react-router";
import { appRoutes } from "@/lib/routes";

export function FrozenBanner() {
  return (
    <section className="mb-6 flex flex-col gap-2 rounded-2xl border border-blue-500/25 bg-blue-950/15 p-5">
      <span className="text-[10px] font-medium tracking-wider text-blue-300 uppercase">
        Verified production run · read-only
      </span>
      <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
        A real public agenda, real email between real inboxes, and every step it took. It is kept
        exactly as it happened, so the buttons here are refused rather than allowed to change the
        record. Open{" "}
        <a href="#how-parallel-worked" className="text-white underline underline-offset-4">
          How Parallel worked
        </a>{" "}
        below for each step, or the Evidence screen to trace any number to its source.
      </p>
      <Link
        to={appRoutes.judges}
        className="w-fit text-sm font-medium text-blue-300 underline-offset-4 hover:underline"
      >
        Run the demo for a workspace you can change
      </Link>
    </section>
  );
}
