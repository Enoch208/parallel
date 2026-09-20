export interface ScreenGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly rotate?: number;
}

export function screenStyle(geometry: ScreenGeometry) {
  return {
    left: `${String(geometry.left)}%`,
    top: `${String(geometry.top)}%`,
    width: `${String(geometry.width)}%`,
    height: `${String(geometry.height)}%`,
    borderRadius: `${String(geometry.radius)}cqw`,
    transform: geometry.rotate === undefined ? undefined : `rotate(${String(geometry.rotate)}deg)`,
  };
}

export const screens = {
  heroLaptop: { left: 11.21, top: 9.27, width: 55.21, height: 51.93, radius: 0.58 },
  emailPhone: { left: 36.6, top: 8.8, width: 26.8, height: 78.27, radius: 3.6 },
} as const satisfies Record<string, ScreenGeometry>;
