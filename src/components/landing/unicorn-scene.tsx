import { useEffect } from "react";

declare global {
  interface Window {
    UnicornStudio?: {
      init: () => Promise<unknown[]>;
      destroy: () => void;
    };
  }
}

const unicornStudioSrc =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";

let runtimeLoad: Promise<void> | undefined;

function loadRuntime(): Promise<void> {
  runtimeLoad ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = unicornStudioSrc;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      runtimeLoad = undefined;
      script.remove();
    };
    document.head.append(script);
  });
  return runtimeLoad;
}

export function UnicornScene({ projectId }: { projectId: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let mounted = true;
    void loadRuntime().then(() => {
      if (mounted) {
        void window.UnicornStudio?.init();
      }
    });
    return () => {
      mounted = false;
      window.UnicornStudio?.destroy();
    };
  }, []);

  return <div data-us-project={projectId} className="absolute left-0 top-0 -z-10 h-full w-full" />;
}
