// Guarded Web Storage for client code. Storage can be blocked (private
// windows, strict privacy settings), so reads and writes never throw and fall
// back to memory for the session. Every write notifies subscribers, as does a
// change from another tab, so useSyncExternalStore snapshots stay current.

export type StorageArea = "local" | "session";

/** All of the app's keys share this prefix. */
export const STORAGE_PREFIX = "stocks-rank:";

const listeners = new Set<() => void>();
// Fallback when storage throws, so the session still works.
const memory = new Map<string, string>();

const area = (a: StorageArea): Storage => (a === "local" ? window.localStorage : window.sessionStorage);

export function readStorage(a: StorageArea, key: string): string | null {
  try {
    return area(a).getItem(key);
  } catch {
    return memory.get(`${a}:${key}`) ?? null;
  }
}

/** Writes (or, with null, removes) without notifying; see `notifyStorage`. */
export function writeStorageQuietly(a: StorageArea, key: string, value: string | null) {
  try {
    if (value === null) area(a).removeItem(key);
    else area(a).setItem(key, value);
  } catch {
    if (value === null) memory.delete(`${a}:${key}`);
    else memory.set(`${a}:${key}`, value);
  }
}

export function writeStorage(a: StorageArea, key: string, value: string | null) {
  writeStorageQuietly(a, key, value);
  notifyStorage();
}

/** Tells subscribers to re-read their snapshots. */
export function notifyStorage() {
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key.startsWith(STORAGE_PREFIX)) notifyStorage();
}

/** For useSyncExternalStore: fires on this tab's writes and on other tabs' changes. */
export function subscribeStorage(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
