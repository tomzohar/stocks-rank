"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** The non-standard event Chromium fires when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Registers the service worker, flags offline mode, and offers "Install app" where supported. */
export function PwaSupport() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Dev builds change on every edit; caching them would only get in the way.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the mini-infobar
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className="pwa">
      {!online && (
        <span className="offline-pill" role="status">
          Offline · showing saved data
        </span>
      )}
      {installPrompt && (
        <button
          type="button"
          className="button button-small"
          onClick={async () => {
            await installPrompt.prompt();
            await installPrompt.userChoice;
            setInstallPrompt(null);
          }}
        >
          Install app
        </button>
      )}
    </div>
  );
}
