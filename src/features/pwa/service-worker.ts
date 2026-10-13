// Registers /sw.js (production only: dev builds change on every edit).

const enabled = () => process.env.NODE_ENV === "production" && "serviceWorker" in navigator;

export function registerServiceWorker() {
  if (!enabled()) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
    console.error("Service worker registration failed:", err);
  });
}

/** Asks the browser to re-check /sw.js now rather than on its own schedule. */
export async function updateServiceWorker() {
  if (!enabled()) return;
  try {
    await (await navigator.serviceWorker.getRegistration())?.update();
  } catch {
    // Offline or blocked: the browser tries again on the next visit.
  }
}
