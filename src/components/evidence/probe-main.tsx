import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { BrowserRouter } from "react-router";
import { AppShell } from "@/components/chrome/app-shell";
import { EvidencePage } from "@/routes/evidence-page";
import { convexClient } from "@/lib/convex-client";
import "@/styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("missing root");
}

createRoot(container).render(
  <ConvexProvider client={convexClient}>
    <BrowserRouter>
      <AppShell>
        <EvidencePage />
      </AppShell>
    </BrowserRouter>
  </ConvexProvider>,
);
