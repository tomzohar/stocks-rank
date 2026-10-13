"use client";

import { useEffect, useState } from "react";
import { updateServiceWorker } from "./service-worker";
import { BUILD_ID, fetchLiveBuild, isNewBuild } from "./version";

/** How often an open, visible window checks for a new deploy. */
const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * True once a newer deploy is live than the one this page is running. Checks
 * when the app comes back to the foreground or online, and every 15 minutes
 * while it's visible. Skipped in development.
 */
export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || available) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const live = await fetchLiveBuild();
      if (cancelled) return;
      if (isNewBuild(BUILD_ID, live)) {
        setAvailable(true);
        void updateServiceWorker();
      }
    };
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const timer = window.setInterval(onVisible, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.clearInterval(timer);
    };
  }, [available]);

  return available;
}
