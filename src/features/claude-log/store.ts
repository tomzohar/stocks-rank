// Keeps the Claude run log in this browser (localStorage) and sends each run's
// summary, without Claude's text, to the server log so failures can be traced
// after the fact. The API key is never part of either.
import { useMemo, useSyncExternalStore } from "react";
import type { MessagesClient } from "@/features/analysis/claude";
import { notifyStorage, readStorage, subscribeStorage, writeStorageQuietly } from "@/lib/browser-storage";
import { appendRun, failedRequest, finishRun, parseRunLog, serverEvent, summarizeMessage, type RequestLog, type RunKind, type RunLog } from "./log";

const LOG_KEY = "stocks-rank:claude-log";

const readLog = () => parseRunLog(readStorage("local", LOG_KEY));

/** The log, newest first; null until the browser has read it. */
export function useRunLog(): RunLog[] | null {
  const raw = useSyncExternalStore(subscribeStorage, () => readStorage("local", LOG_KEY) ?? "", () => null);
  return useMemo(() => (raw === null ? null : parseRunLog(raw)), [raw]);
}

export function clearRunLog() {
  writeStorageQuietly("local", LOG_KEY, null);
  notifyStorage();
}

/** A client that notes every request it makes, finished or failed. */
export function recordingClient(client: MessagesClient, record: (entry: RequestLog) => void): MessagesClient {
  return {
    beta: {
      messages: {
        stream(params) {
          const started = performance.now();
          const stream = client.beta.messages.stream(params);
          const requestId = () => (stream as { request_id?: string | null }).request_id ?? null;
          return {
            finalMessage: () =>
              stream.finalMessage().then(
                (message) => {
                  record(summarizeMessage(message, { ms: performance.now() - started, requestId: requestId() }));
                  return message;
                },
                (err: unknown) => {
                  record(failedRequest(err, { ms: performance.now() - started, requestId: requestId() }));
                  throw err;
                },
              ),
          };
        },
      },
    },
  };
}

function save(run: RunLog) {
  writeStorageQuietly("local", LOG_KEY, JSON.stringify(appendRun(readLog(), run)));
  notifyStorage();
  console.info(`Claude ${run.kind} run for ${run.subject}: ${run.outcome}`, run);
  // Best effort: the run already happened, and the browser copy is the full one.
  fetch("/api/claude-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serverEvent(run)),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Runs `work` with a client that records each request, then logs the run,
 * whether it succeeded or threw. Returns (or rethrows) what `work` did.
 */
export async function logClaudeRun<T>(
  { kind, subject }: { kind: RunKind; subject: string },
  client: MessagesClient,
  work: (client: MessagesClient) => Promise<T>,
): Promise<T> {
  const start = { id: crypto.randomUUID(), kind, subject, startedAt: new Date().toISOString() };
  const began = performance.now();
  const requests: RequestLog[] = [];
  const recorded = recordingClient(client, (r) => requests.push(r));
  try {
    const result = await work(recorded);
    save(finishRun(start, { ms: performance.now() - began, requests }));
    return result;
  } catch (error) {
    save(finishRun(start, { ms: performance.now() - began, requests, failure: { error } }));
    throw error;
  }
}
