// Scores for the judgement-call metrics (8–13) live in the browser, per symbol.
// Exposed as a useSyncExternalStore-compatible store so every component reading
// a symbol's scores — and other tabs — stay in sync.
import { QUALITATIVE_METRIC_IDS, SCORE_VALUES, type QualitativeMetricId, type Score } from "./scoring/metrics";

export type QualitativeScores = Partial<Record<QualitativeMetricId, Score>>;

const storageKey = (symbol: string) => `stocks-rank:qualitative:${symbol}`;

/** Parses stored JSON, dropping anything that isn't a known metric with a 0/5/10 score. */
export function parseQualitative(raw: string | null): QualitativeScores {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  const out: QualitativeScores = {};
  for (const id of QUALITATIVE_METRIC_IDS) {
    const v = (data as Record<string, unknown>)[id];
    if (SCORE_VALUES.includes(v as Score)) out[id] = v as Score;
  }
  return out;
}

// Writes land here first so the UI still works when localStorage is unavailable
// (private browsing, blocked storage).
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function onStorage(e: StorageEvent) {
  if (e.key?.startsWith("stocks-rank:qualitative:")) memory.delete(e.key);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Raw stored string — a stable snapshot value for useSyncExternalStore. */
export function getRaw(symbol: string): string | null {
  const key = storageKey(symbol);
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setScore(symbol: string, id: QualitativeMetricId, score: Score | null): void {
  const next = { ...parseQualitative(getRaw(symbol)) };
  if (score === null) delete next[id];
  else next[id] = score;
  const key = storageKey(symbol);
  const raw = Object.keys(next).length ? JSON.stringify(next) : null;
  memory.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    // Storage unavailable: the in-memory copy keeps the session working.
  }
  listeners.forEach((l) => l());
}
