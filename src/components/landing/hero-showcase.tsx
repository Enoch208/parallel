import type { CSSProperties } from "react";
import { landingImages } from "./landing-images";
import { BoardPreview } from "./screens/board-preview";
import { CoverPhoto } from "./screens/cover-photo";
import { ScreenSurface } from "./screens/screen-surface";
import { screens } from "./screens/screen-geometry";

const edgeFade: CSSProperties = {
  maskImage:
    "linear-gradient(to right, transparent, black 14%, black 86%, transparent), linear-gradient(to bottom, transparent, black 9%, black 55%, transparent)",
  maskComposite: "intersect",
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 14%, black 86%, transparent), linear-gradient(to bottom, transparent, black 9%, black 55%, transparent)",
  WebkitMaskComposite: "source-in",
};

export function HeroShowcase() {
  return (
    <div className="animate-on-scroll [animation:fadeInUp_0.9s_ease-out_0.5s_both] relative mx-auto aspect-[16/10] w-full max-w-6xl">
      <div className="absolute inset-0" style={edgeFade}>
        <CoverPhoto
          image={landingImages.heroLaptop}
          loading="eager"
          frameClassName=""
          motionClassName=""
          imageClassName=""
        >
          <ScreenSurface geometry={screens.heroLaptop}>
            <BoardPreview />
          </ScreenSurface>
        </CoverPhoto>
      </div>
    </div>
  );
}
