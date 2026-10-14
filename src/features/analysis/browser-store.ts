// Browser-side state for Claude's analysis: the viewer's API key and a
// per-stock cache of finished analyses, kept with lib/browser-storage and read
// through useSyncExternalStore. Nothing here is ever sent to the stocks-rank server.
import { z } from "zod";
import { notifyStorage, readStorage, subscribeStorage, writeStorageQuietly } from "@/lib/browser-storage";
import { logClaudeRun } from "@/features/claude-log/store";
import { QUALITATIVE_METRIC_IDS } from "@/features/scoring/metrics";
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

/** For useSyncExternalStore: fires when the key, a cached analysis or a run changes. */
export const subscribe = subscribeStorage;

// ---- API key ----

/** The viewer's key: this tab's first, then one remembered on the device. */
export function getApiKey(): string | null {
  return readStorage("session", KEY_STORAGE) ?? readStorage("local", KEY_STORAGE);
}

/** Session-only by default; `remember` keeps it on this device until forgotten. */
export function setApiKey(key: string, remember: boolean) {
  forgetApiKey();
  writeStorageQuietly(remember ? "local" : "session", KEY_STORAGE, key.trim());
  notifyStorage();
}

export function forgetApiKey() {
  writeStorageQuietly("session", KEY_STORAGE, null);
  writeStorageQuietly("local", KEY_STORAGE, null);
  notifyStorage();
}

// ---- analysis cache ----

/** Raw cached entry for useSyncExternalStore (a stable string snapshot). */
export function getStoredAnalysisRaw(symbol: string): string | null {
  return readStorage("local", analysisStorageKey(symbol));
}

export function storeAnalysis(symbol: string, analysis: QualitativeAnalysis) {
  writeStorageQuietly("local", analysisStorageKey(symbol), JSON.stringify({ savedAt: Date.now(), analysis }));
  notifyStorage();
}

export function clearStoredAnalysis(symbol: string) {
  writeStorageQuietly("local", analysisStorageKey(symbol), null);
  notifyStorage();
}

// ---- running an analysis ----

const inFlight = new Map<string, Promise<void>>();

/** True while any analysis is running in this tab (reloading now would waste a paid run). */
export function isAnalysisRunning(): boolean {
  return inFlight.size > 0;
}

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
    const analysis = await logClaudeRun({ kind: "scoring", subject: subject.symbol }, createBrowserClient(apiKey), (client) =>
      analyzeWithClaude(subject, { client }),
    );
    storeAnalysis(subject.symbol, analysis);
  })().finally(() => {
    inFlight.delete(subject.symbol);
    notifyStorage();
  });
  inFlight.set(subject.symbol, run);
  notifyStorage();
  return run;
}
