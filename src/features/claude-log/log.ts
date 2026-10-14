// A record of every Claude run the app makes: what each request did (searches,
// their results or error codes, stop reason, model, tokens) and what went
// wrong. Pure: it turns API messages into small plain objects and flags the
// problems worth a look. store.ts keeps them in the browser.
import type Anthropic from "@anthropic-ai/sdk";

type BetaMessage = Anthropic.Beta.BetaMessage;

export const RUN_KINDS = ["scoring", "picks", "proposal"] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export const RUN_KIND_LABEL: Record<RunKind, string> = {
  scoring: "Scoring",
  picks: "Stock picks",
  proposal: "Portfolio proposal",
};

/** Runs kept in the browser, newest first. */
export const MAX_RUNS = 50;
/** Claude's own words kept per request: enough to see what it said, not the whole essay. */
const TEXT_LIMIT = 1500;
const INPUT_LIMIT = 300;
const ERROR_LIMIT = 500;

/** One server tool call inside a request: a web search, or the code that filters its results. */
export interface ToolStep {
  tool: string;
  /** The search query, or the start of the code. */
  input: string;
  /** "8 results", "error: max_uses_exceeded", "exit 1: …", or "no result" when the turn paused. */
  result: string;
  ok: boolean;
}

export interface RequestLog {
  ms: number;
  /** The model that answered (differs from the requested one after a fallback). */
  model: string | null;
  stopReason: string | null;
  /** Anthropic's request id, for support. */
  requestId: string | null;
  /** A safety classifier declined and another model finished the answer. */
  fallback: boolean;
  usage: { input: number; output: number; cacheRead: number; searches: number; fetches: number };
  steps: ToolStep[];
  /** Claude's visible text in this request, shortened. */
  text: string;
  /** The submit tool Claude called, if any. */
  submitted: string | null;
  /** Sentences in Claude's text or answer that say searching went badly. */
  searchRemarks: string[];
  /** Set when the request itself failed (network, API error). */
  error: string | null;
}

export interface RunLog {
  id: string;
  kind: RunKind;
  /** What the run was about: a symbol, or "6 stocks". */
  subject: string;
  startedAt: string;
  ms: number;
  outcome: "ok" | "error";
  error: string | null;
  requests: RequestLog[];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: unknown }).status;
    return clip(oneLine(`${err.name}${typeof status === "number" ? ` ${status}` : ""}: ${err.message}`), ERROR_LIMIT);
  }
  return clip(oneLine(String(err)), ERROR_LIMIT);
}

/** A result block's content, said in a few words. */
function describeResult(content: unknown): { result: string; ok: boolean } {
  if (Array.isArray(content)) return { result: `${content.length} result${content.length === 1 ? "" : "s"}`, ok: content.length > 0 };
  if (content && typeof content === "object") {
    const c = content as { error_code?: unknown; return_code?: unknown; stderr?: unknown; type?: unknown };
    if (typeof c.error_code === "string") return { result: `error: ${c.error_code}`, ok: false };
    if (typeof c.return_code === "number") {
      const stderr = typeof c.stderr === "string" ? oneLine(c.stderr) : "";
      return c.return_code === 0
        ? { result: "ran", ok: true }
        : { result: clip(`exit ${c.return_code}${stderr ? `: ${stderr}` : ""}`, INPUT_LIMIT), ok: false };
    }
    if (typeof c.type === "string") return { result: c.type.replace(/_/g, " "), ok: true };
  }
  return { result: "returned", ok: true };
}

function describeInput(input: unknown): string {
  if (input && typeof input === "object") {
    const i = input as Record<string, unknown>;
    for (const key of ["query", "url", "code", "command"]) {
      if (typeof i[key] === "string") return clip(oneLine(i[key] as string), INPUT_LIMIT);
    }
  }
  return clip(oneLine(JSON.stringify(input) ?? ""), INPUT_LIMIT);
}

const SEARCH_TROUBLE =
  /\b(limit|unavailab|not available|fail|couldn'?t|could not|unable|no results|did ?n[o']t return|restrict|error|outage|blocked)/i;

/** Sentences that mention searching and trouble together. */
export function searchRemarks(text: string): string[] {
  return oneLine(text)
    .split(/(?<=[.!?])\s+/)
    .filter((s) => /search/i.test(s) && SEARCH_TROUBLE.test(s))
    .map((s) => clip(s, INPUT_LIMIT));
}

/** Every string in a tool input (rationales, summary, tips), for scanning. */
function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

const emptyUsage = { input: 0, output: 0, cacheRead: 0, searches: 0, fetches: 0 };

/** One finished request, in plain terms. */
export function summarizeMessage(message: BetaMessage, { ms, requestId = null }: { ms: number; requestId?: string | null }): RequestLog {
  const results = new Map<string, unknown>();
  for (const block of message.content) {
    const b = block as { tool_use_id?: unknown; content?: unknown };
    if (typeof b.tool_use_id === "string") results.set(b.tool_use_id, b.content);
  }

  const steps: ToolStep[] = [];
  const texts: string[] = [];
  let submitted: string | null = null;
  let submittedInput: unknown = null;
  for (const block of message.content) {
    if (block.type === "server_tool_use") {
      const r = results.has(block.id) ? describeResult(results.get(block.id)) : { result: "no result", ok: false };
      steps.push({ tool: block.name, input: describeInput(block.input), ...r });
    } else if (block.type === "text") {
      texts.push(block.text);
    } else if (block.type === "tool_use") {
      submitted = block.name;
      submittedInput = block.input;
    }
  }

  const text = texts.join("\n\n").trim();
  const usage = message.usage;
  return {
    ms,
    model: message.model ?? null,
    stopReason: message.stop_reason ?? null,
    requestId,
    fallback:
      message.content.some((b) => b.type === "fallback") ||
      ((usage?.iterations ?? []) as { type?: string }[]).some((i) => i.type === "fallback_message"),
    usage: usage
      ? {
          input: usage.input_tokens ?? 0,
          output: usage.output_tokens ?? 0,
          cacheRead: usage.cache_read_input_tokens ?? 0,
          searches: usage.server_tool_use?.web_search_requests ?? 0,
          fetches: usage.server_tool_use?.web_fetch_requests ?? 0,
        }
      : emptyUsage,
    steps,
    text: clip(text, TEXT_LIMIT),
    submitted,
    searchRemarks: [...new Set([text, ...stringsIn(submittedInput)].flatMap(searchRemarks))].slice(0, 5),
    error: null,
  };
}

/** A request that never came back with a message. */
export function failedRequest(err: unknown, { ms, requestId = null }: { ms: number; requestId?: string | null }): RequestLog {
  return {
    ms,
    model: null,
    stopReason: null,
    requestId,
    fallback: false,
    usage: emptyUsage,
    steps: [],
    text: "",
    submitted: null,
    searchRemarks: [],
    error: errorText(err),
  };
}

export function finishRun(
  start: { id: string; kind: RunKind; subject: string; startedAt: string },
  { ms, requests, failure }: { ms: number; requests: RequestLog[]; failure?: { error: unknown } },
): RunLog {
  return {
    ...start,
    ms,
    outcome: failure ? "error" : "ok",
    error: failure ? errorText(failure.error) : null,
    requests,
  };
}

export interface RunTotals {
  input: number;
  output: number;
  cacheRead: number;
  searches: number;
}

export function runTotals(run: RunLog): RunTotals {
  return run.requests.reduce(
    (t, r) => ({
      input: t.input + r.usage.input,
      output: t.output + r.usage.output,
      cacheRead: t.cacheRead + r.usage.cacheRead,
      searches: t.searches + r.usage.searches,
    }),
    { input: 0, output: 0, cacheRead: 0, searches: 0 },
  );
}

/** What deserves a look in a run, worst first. Empty when it went cleanly. */
export function runIssues(run: RunLog): string[] {
  const issues: string[] = [];
  if (run.outcome === "error" && run.error) issues.push(`Failed: ${run.error}`);

  const failed = new Map<string, number>();
  for (const r of run.requests) {
    for (const s of r.steps) if (!s.ok) failed.set(`${s.tool} ${s.result}`, (failed.get(`${s.tool} ${s.result}`) ?? 0) + 1);
  }
  for (const [what, n] of failed) issues.push(`${what.replace(/^web_search /, "Web search ")}${n > 1 ? ` (×${n})` : ""}`);

  if (run.kind === "scoring" && run.outcome === "ok" && run.requests.every((r) => r.steps.every((s) => s.tool !== "web_search"))) {
    issues.push("No web searches");
  }
  const remarks = run.requests.flatMap((r) => r.searchRemarks);
  if (remarks.length) issues.push("Claude said searching was limited");
  const fallback = run.requests.find((r) => r.fallback);
  if (fallback) issues.push(`Finished by fallback model ${fallback.model ?? ""}`.trim());
  for (const r of run.requests) {
    if (r.stopReason === "max_tokens" || r.stopReason === "refusal") issues.push(`Stopped: ${r.stopReason}`);
  }
  if (run.requests.some((r) => r.stopReason === "end_turn" && !r.submitted)) issues.push("Needed a nudge to answer");
  return issues;
}

/** The new run first, at most MAX_RUNS kept. */
export function appendRun(log: readonly RunLog[], run: RunLog): RunLog[] {
  return [run, ...log.filter((r) => r.id !== run.id)].slice(0, MAX_RUNS);
}

/** The stored log, or empty when missing or unreadable (it's diagnostics, never worth an error). */
export function parseRunLog(raw: string | null): RunLog[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RunLog =>
        !!r &&
        typeof r === "object" &&
        typeof (r as RunLog).id === "string" &&
        RUN_KINDS.includes((r as RunLog).kind) &&
        Array.isArray((r as RunLog).requests),
    );
  } catch {
    return [];
  }
}

/**
 * What the server log gets: the run without Claude's text, which can echo
 * the viewer's own notes and amounts. Never includes the API key.
 */
export function serverEvent(run: RunLog) {
  return {
    id: run.id,
    kind: run.kind,
    subject: run.subject,
    startedAt: run.startedAt,
    ms: Math.round(run.ms),
    outcome: run.outcome,
    error: run.error,
    issues: runIssues(run),
    requests: run.requests.map((r) => ({
      ms: Math.round(r.ms),
      model: r.model,
      stopReason: r.stopReason,
      requestId: r.requestId,
      fallback: r.fallback,
      usage: r.usage,
      steps: r.steps.map((s) => ({ ...s, input: s.tool === "web_search" ? s.input : "" })),
      submitted: r.submitted,
      searchRemarks: r.searchRemarks,
      error: r.error,
    })),
  };
}
export type ServerEvent = ReturnType<typeof serverEvent>;
