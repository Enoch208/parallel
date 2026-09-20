import heroLaptop from "@/assets/landing/hero-laptop.webp";
import emailPhone from "@/assets/landing/email-phone.webp";
import tileImport from "@/assets/landing/tile-import.webp";
import tileIntent from "@/assets/landing/tile-intent.webp";
import tileOptimize from "@/assets/landing/tile-optimize.webp";
import tileRepair from "@/assets/landing/tile-repair.webp";
import closingHall from "@/assets/landing/closing-hall.webp";
import sharedBrief from "@/assets/landing/shared-brief.webp";

import type { LandingImage } from "./screens/cover-photo";

export const landingImages = {
  heroLaptop: { src: heroLaptop, width: 2400, height: 1500 },
  emailPhone: { src: emailPhone, width: 2000, height: 1500 },
  tileImport: { src: tileImport, width: 1254, height: 1254 },
  tileIntent: { src: tileIntent, width: 1254, height: 1254 },
  tileOptimize: { src: tileOptimize, width: 1254, height: 1254 },
  tileRepair: { src: tileRepair, width: 1254, height: 1254 },
  closingHall: { src: closingHall, width: 2520, height: 1080 },
  sharedBrief: { src: sharedBrief, width: 1254, height: 1254 },
} as const satisfies Record<string, LandingImage>;
