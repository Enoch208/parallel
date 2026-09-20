import type { CSSProperties } from "react";
import { landingImages } from "./landing-images";
import { CoverPhoto } from "./screens/cover-photo";
import { PhoneThread } from "./screens/phone-thread";
import { ScreenSurface } from "./screens/screen-surface";
import { screens } from "./screens/screen-geometry";

const edgeFade: CSSProperties = {
  maskImage:
    "linear-gradient(to right, transparent, black 20%, black 80%, transparent), linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
  maskComposite: "intersect",
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 20%, black 80%, transparent), linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
  WebkitMaskComposite: "source-in",
};

export function PhoneShowcase() {
  return (
    <div className="relative aspect-[4/3] w-full">
      <div className="absolute inset-0" style={edgeFade}>
        <CoverPhoto
          image={landingImages.emailPhone}
          frameClassName=""
          motionClassName=""
          imageClassName=""
        >
          <ScreenSurface geometry={screens.emailPhone}>
            <PhoneThread />
          </ScreenSurface>
        </CoverPhoto>
      </div>
    </div>
  );
}
