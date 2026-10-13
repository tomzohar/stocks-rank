"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Toast } from "@/ui/Toast";
import { addToWatchlist, removeFromWatchlist, undoRemove, useWatchlist, type Removed } from "../store";
import { MAX_WATCHLIST } from "../watchlist";
import styles from "./WatchButton.module.css";

/** Keys each toast so a new one restarts its timer. */
let toastSeq = 0;

type Notice = { id: number } & ({ kind: "added" } | { kind: "removed"; removed: Removed } | { kind: "full" });

/** "Add to Watchlist" on a stock's page, with a toast to view the list or undo. */
export function WatchButton({ symbol }: { symbol: string }) {
  const router = useRouter();
  const list = useWatchlist();
  const [notice, setNotice] = useState<Notice | null>(null);
  const watched = list?.some((e) => e.symbol === symbol) ?? false;

  function toggle() {
    const id = ++toastSeq;
    if (watched) {
      const removed = removeFromWatchlist(symbol);
      setNotice(removed ? { id, kind: "removed", removed } : null);
    } else if ((list?.length ?? 0) >= MAX_WATCHLIST) {
      setNotice({ id, kind: "full" });
    } else {
      addToWatchlist(symbol);
      setNotice({ id, kind: "added" });
    }
  }

  return (
    <>
      <Button
        variant={watched ? "secondary" : "tinted"}
        icon={watched ? "starFill" : "star"}
        aria-pressed={watched}
        // Hidden until the browser has read the list, so it doesn't flip after loading.
        className={cx(styles.button, list === null && styles.unknown, watched && styles.on)}
        onClick={toggle}
      >
        {watched ? "In Watchlist" : "Add to Watchlist"}
      </Button>
      {notice?.kind === "added" && (
        <Toast
          key={notice.id}
          icon="starFill"
          action={{ label: "View", onClick: () => router.push("/watchlist") }}
          onDismiss={() => setNotice(null)}
        >
          Added {symbol} to your watchlist
        </Toast>
      )}
      {notice?.kind === "removed" && (
        <Toast
          key={notice.id}
          icon="trash"
          action={{ label: "Undo", onClick: () => undoRemove(notice.removed) }}
          onDismiss={() => setNotice(null)}
        >
          Removed {symbol}
        </Toast>
      )}
      {notice?.kind === "full" && (
        <Toast key={notice.id} icon="alert" onDismiss={() => setNotice(null)}>
          Your watchlist is full ({MAX_WATCHLIST} stocks)
        </Toast>
      )}
    </>
  );
}
