import type { ReactNode } from "react";

export interface LandingImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

interface CoverPhotoProps {
  image: LandingImage;
  loading?: "eager" | "lazy";
  focusX?: number;
  frameClassName: string;
  motionClassName: string;
  imageClassName: string;
  children?: ReactNode;
}

export function CoverPhoto({
  image,
  loading = "lazy",
  focusX = 0.5,
  frameClassName,
  motionClassName,
  imageClassName,
  children,
}: CoverPhotoProps) {
  const ratio = image.width / image.height;

  return (
    <div className={`absolute inset-0 overflow-hidden [container-type:size] ${frameClassName}`}>
      <div
        className={`absolute top-1/2 -translate-y-1/2 ${motionClassName}`}
        style={{
          left: `calc((100cqw - max(100cqw, calc(100cqh * ${String(ratio)}))) * ${String(focusX)})`,
          width: `max(100cqw, calc(100cqh * ${String(ratio)}))`,
          height: `max(100cqh, calc(100cqw / ${String(ratio)}))`,
        }}
      >
        <img
          src={image.src}
          alt=""
          loading={loading}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
        />
        {children}
      </div>
    </div>
  );
}
