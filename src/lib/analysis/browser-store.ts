// Browser-side state for Claude's analysis: the viewer's API key and a
// per-stock cache of finished analyses. Exposed as useSyncExternalStore
// stores. Nothing here is ever sent to the stocks-rank server.
import { z } from "zod";
import { QUALITATIVE_METRIC_IDS } from "../scoring/metrics";
import { ANALYSIS_VERSION } from "./prompt";
import type { AnalysisSubject, QualitativeAnalysis } from "./types";

const KEY_STORAGE = "stocks-rank:anthropic-api-key";
const analysisStorageKey = (symbol: string) => `stocks-rank:analysis:v${ANALYSIS_VERSION}:${symbol}`;
export const ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---- pure helpers (tested) ----

/** Anthropic API keys start with "sk-ant-". */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-\S{20,}$/.test(key.trim());
}

/** "sk-ant-…wxyz": enough to recognise a key, useless to anyone else. */
export function keyHint(key: string): string {
  return `sk-ant-…${key.trim().slice(-4)}`;
}

const assessment = z.object({ score: z.union([z.literal(0), z.literal(5), z.literal(10)]), rationale: z.string() });
const storedAnalysis = z.object({
  savedAt: z.number(),
  analysis: z.object({
    metrics: z.object(Object.fromEntries(QUALITATIVE_METRIC_IDS.map((id) => [id, assessment]))),
    summary: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })),
    model: z.string(),
    analyzedAt: z.string(),
    source: z.enum(["claude", "demo"]),
  }),
});

export interface StoredAnalysis {
  analysis: QualitativeAnalysis;
  /** When it was saved in this browser, and when it stops being used (ms since epoch). */
  savedAt: number;
  expiresAt: number;
}

/** A cached analysis, or null if missing, corrupt or older than the TTL. */
export function parseStoredAnalysis(raw: string | null, nowMs: number): StoredAnalysis | null {
  if (!raw) return null;
  try {
    const parsed = storedAnalysis.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { savedAt, analysis } = parsed.data;
    const expiresAt = savedAt + ANALYSIS_TTL_MS;
    if (nowMs >= expiresAt) return null;
    return { analysis: analysis as QualitativeAnalysis, savedAt, expiresAt };
  } catch {
    return null;
  }
}

// ---- storage (guarded: storage can be blocked, e.g. in private windows) ----

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
// Fallback when storage throws, so the session still works.
const memory = new Map<string, string>();

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
}
const local = () => window.localStorage;
const session = () => window.sessionStorage;

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key.startsWith("stocks-rank:")) notify();
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

// ---- API key ----

/** The viewer's key: this tab's first, then one remembered on the device. */
export function getApiKey(): string | null {
  return read(session, KEY_STORAGE) ?? read(local, KEY_STORAGE);
}

/** Session-only by default; `remember` keeps it on this device until forgotten. */
export function setApiKey(key: string, remember: boolean) {
  forgetApiKey();
  write(remember ? local : session, KEY_STORAGE, key.trim());
  notify();
}

export function forgetApiKey() {
  write(session, KEY_STORAGE, null);
  write(local, KEY_STORAGE, null);
  notify();
}

// ---- analysis cache ----

/** Raw cached entry for useSyncExternalStore (a stable string snapshot). */
export function getStoredAnalysisRaw(symbol: string): string | null {
  return read(local, analysisStorageKey(symbol));
}

export function storeAnalysis(symbol: string, analysis: QualitativeAnalysis) {
  write(local, analysisStorageKey(symbol), JSON.stringify({ savedAt: Date.now(), analysis }));
  notify();
}

export function clearStoredAnalysis(symbol: string) {
  write(local, analysisStorageKey(symbol), null);
  notify();
}

// ---- running an analysis ----

const inFlight = new Map<string, Promise<void>>();

/**
 * Runs Claude's analysis for a stock with the viewer's key and caches it.
 * Concurrent calls for the same stock share one request: each run is billed.
 */
export function runAnalysis(subject: AnalysisSubject, apiKey: string): Promise<void> {
  const running = inFlight.get(subject.symbol);
  if (running) return running;
  const run = (async () => {
    // Loaded on demand so the SDK stays out of the initial page bundle.
    const { analyzeWithClaude, createBrowserClient } = await import("./claude");
    const analysis = await analyzeWithClaude(subject, { client: createBrowserClient(apiKey) });
    storeAnalysis(subject.symbol, analysis);
  })().finally(() => inFlight.delete(subject.symbol));
  inFlight.set(subject.symbol, run);
  return run;
}
