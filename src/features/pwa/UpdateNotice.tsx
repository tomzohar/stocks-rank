"use client";

import { useState, useSyncExternalStore } from "react";
import { isAnalysisRunning, subscribe } from "@/features/analysis/browser-store";
import { isPortfolioRunning } from "@/features/portfolio/store";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { useUpdateAvailable } from "./useUpdateAvailable";
import styles from "./UpdateNotice.module.css";

/**
 * "New version available · Reload", for windows left open across a deploy.
 * Holds off while Claude is mid-analysis or mid-proposal, since reloading
 * would throw away a run that's already being billed.
 */
export function UpdateNotice() {
  const available = useUpdateAvailable();
  const [dismissed, setDismissed] = useState(false);
  const busy = useSyncExternalStore(subscribe, () => isAnalysisRunning() || isPortfolioRunning(), () => false);
  if (!available || dismissed) return null;
  return (
    <div className={styles.toast} role="status">
      <span className={styles.icon}>
        <Icon name="sparkle" size={16} />
      </span>
      <div className={styles.text}>
        <strong>New version available</strong>
        <span>{busy ? "Reload once Claude finishes." : "Reload to get the latest stocks-rank."}</span>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Button variant="primary" size="sm" icon="refresh" disabled={busy} onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
