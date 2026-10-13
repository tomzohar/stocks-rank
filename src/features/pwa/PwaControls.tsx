"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { registerServiceWorker } from "./service-worker";
import styles from "./PwaControls.module.css";

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

/** Registers the service worker; shows an offline badge and, where supported, "Install app". */
export function PwaControls() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(registerServiceWorker, []);

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
    <div className={styles.controls}>
      {!online && (
        <span className={styles.offline} role="status">
          <Icon name="offline" size={14} />
          Offline · showing saved data
        </span>
      )}
      {installPrompt && (
        <Button
          size="sm"
          icon="download"
          onClick={async () => {
            await installPrompt.prompt();
            await installPrompt.userChoice;
            setInstallPrompt(null);
          }}
        >
          Install app
        </Button>
      )}
    </div>
  );
}
