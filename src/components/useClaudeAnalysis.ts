"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  clearStoredAnalysis,
  getApiKey,
  getStoredAnalysisRaw,
  parseStoredAnalysis,
  runAnalysis,
  subscribe,
} from "@/lib/analysis/browser-store";
import { demoAnalysis } from "@/lib/analysis/demo";
import type { AnalysisState, AnalysisSubject } from "@/lib/analysis/types";

const noop = () => () => {};

interface Failure {
  symbol: string;
  key: string;
  message: string;
  keyRejected: boolean;
}

/**
 * Claude's scores for metrics 8–13 of one stock: from the browser cache, or
 * by running the analysis with the viewer's own key. `demoAsOf` switches to
 * offline demo scores.
 */
export function useClaudeAnalysis(subject: AnalysisSubject, demoAsOf: string | null) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const apiKey = useSyncExternalStore(subscribe, getApiKey, () => null);
  const storedRaw = useSyncExternalStore(subscribe, () => getStoredAnalysisRaw(subject.symbol), () => null);
  const [failure, setFailure] = useState<Failure | null>(null);

  // The snapshot only changes when the entry does; expiry is checked against
  // the time it was read.
  const [readAt] = useState(() => Date.now());
  const cached = useMemo(() => parseStoredAnalysis(storedRaw, readAt), [storedRaw, readAt]);
  const failed = failure && failure.symbol === subject.symbol && failure.key === apiKey ? failure : null;
  const shouldRun = hydrated && !demoAsOf && !cached && !!apiKey && !failed;

  useEffect(() => {
    if (!shouldRun || !apiKey) return;
    // Not cancelled on navigation: the run is paid for, so let it finish and cache.
    runAnalysis(subject, apiKey).catch(async (err: unknown) => {
      const { describeAnalysisError, isKeyRejected } = await import("@/lib/analysis/errors");
      setFailure({
        symbol: subject.symbol,
        key: apiKey,
        message: describeAnalysisError(err),
        keyRejected: isKeyRejected(err),
      });
    });
  }, [shouldRun, apiKey, subject]);

  let state: AnalysisState;
  if (demoAsOf) state = { status: "ready", analysis: demoAnalysis(subject, new Date(demoAsOf)) };
  else if (!hydrated) state = { status: "checking" };
  else if (cached) state = { status: "ready", analysis: cached };
  else if (failed) state = { status: "error", message: failed.message, keyRejected: failed.keyRejected };
  else if (!apiKey) state = { status: "needs-key" };
  else state = { status: "pending" };

  return {
    state,
    apiKey,
    /** Try again after a failure. */
    retry: () => setFailure(null),
    /** Drop the cached result and analyze again (billed). */
    reanalyze: () => {
      setFailure(null);
      clearStoredAnalysis(subject.symbol);
    },
  };
}
