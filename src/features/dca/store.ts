// Your average buy price per stock, kept in this browser's localStorage. It
// never leaves the device: the rules run in the page.
import { useSyncExternalStore } from "react";
import { readStorage, STORAGE_PREFIX, subscribeStorage, writeStorage } from "@/lib/browser-storage";

const key = (symbol: string) => `${STORAGE_PREFIX}avg-cost:${symbol}`;

export function parseStoredCost(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The saved average buy price; undefined until the browser has been read. */
export function useAvgCost(symbol: string): number | null | undefined {
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => readStorage("local", key(symbol)),
    () => undefined,
  );
  return raw === undefined ? undefined : parseStoredCost(raw);
}

export function saveAvgCost(symbol: string, price: number | null) {
  writeStorage("local", key(symbol), price === null ? null : String(price));
}
