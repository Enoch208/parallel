import { GoalBarsGlyph, SessionGridGlyph, SharedRoomGlyph } from "./measure-glyphs";
import { SectionHeading } from "./section-heading";

const measures = [
  {
    name: "Team Goal Coverage",
    Glyph: GoalBarsGlyph,
    scale: "0 to 100, no percent sign",
    caption:
      "How strongly the team's assigned sessions cover its weighted goals, with diminishing returns for redundant sessions. A score from 0 to 100.",
  },
  {
    name: "Unique sessions assigned",
    Glyph: SessionGridGlyph,
    scale: "Out of teammates × time slots",
    caption:
      "How many different sessions the team covers, against the most it could physically attend: teammates multiplied by time slots.",
  },
  {
    name: "Duplicate attendances",
    Glyph: SharedRoomGlyph,
    scale: "Reported, never hidden",
    caption:
      "How many times two teammates sit in the same room at the same time. Sometimes that is the right call, so it is reported, not forbidden.",
  },
] as const;

export function CoverageSection() {
  return (
    <section id="coverage" className="relative z-10 mx-auto max-w-6xl scroll-mt-28 px-6 py-20">
      <SectionHeading
        eyebrow="What it measures"
        title="Three numbers, and none of them are guesses"
        lede="The optimizer is deterministic and unit tested. No model decides who attends what, computes a score, or declares a plan feasible."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {measures.map((measure, index) => (
          <div
            key={measure.name}
            className="animate-on-scroll flex flex-col gap-3 rounded-3xl border border-white/5 bg-white/[0.02] p-6"
            style={{ animation: `fadeInUp 0.6s ease-out ${String(index * 0.1)}s both` }}
          >
            <div className="mb-2 h-28 rounded-2xl border border-white/5 bg-black/40 p-4">
              <measure.Glyph />
            </div>
            <h3 className="text-base font-medium tracking-tight text-white">{measure.name}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">{measure.caption}</p>
            <span className="mt-auto pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">
              {measure.scale}
            </span>
          </div>
        ))}
      </div>

      <p className="animate-on-scroll [animation:fadeInUp_0.6s_ease-out_0.3s_both] mt-8 max-w-2xl text-xs font-light leading-relaxed text-neutral-600">
        The drawings are schematic. Figures fill in from your team&rsquo;s own plan, and nothing on
        this page is a sample number.
      </p>
    </section>
  );
}
