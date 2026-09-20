import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (convexUrl.length === 0) {
  throw new Error("VITE_CONVEX_URL is not set; build through the Convex CLI so it is injected");
}

export const convexClient = new ConvexReactClient(convexUrl);
