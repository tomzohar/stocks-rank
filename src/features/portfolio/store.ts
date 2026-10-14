// Browser state for portfolios: the saved list (localStorage), the builder's
// draft (sessionStorage, so a reload mid-way keeps your place and a paid
// proposal), the Claude runs in flight, and each holding's DCA reading.
// Nothing here reaches the stocks-rank server except the /api/stock/…/dca
// requests for price readings; Claude is called with the viewer's own key.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { logClaudeRun } from "@/features/claude-log/store";
import type { DcaReading } from "@/features/dca/reading";
import {
  notifyStorage,
  readStorage,
  STORAGE_PREFIX,
  subscribeStorage,
  writeStorage,
  writeStorageQuietly,
} from "@/lib/browser-storage";
import { DEFAULT_RULES, type Candidate, type SelectionRules } from "./candidates";
import { demoPicks, scoreWeightedPlan } from "./heuristic";
import { cleanPlan, MAX_HOLDINGS, parsePortfolios, planSchema, serializePortfolios, upsertPortfolio, type Plan, type Portfolio } from "./model";
import type { PickGoal, PickRequest, PickResult } from "./prompt";

const LIST_KEY = `${STORAGE_PREFIX}portfolios`;
const DRAFT_KEY = `${STORAGE_PREFIX}portfolio-draft`;
const readingKey = (symbol: string) => `${STORAGE_PREFIX}dca-reading:${symbol}`;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---- saved portfolios ----

const getListRaw = () => readStorage("local", LIST_KEY);
const currentList = () => parsePortfolios(getListRaw());

/** The saved portfolios, or null until the browser has read them. */
export function usePortfolios(): Portfolio[] | null {
  const raw = useSyncExternalStore(subscribeStorage, getListRaw, () => undefined);
  return useMemo(() => (raw === undefined ? null : parsePortfolios(raw)), [raw]);
}

/** Saves a plan as a new portfolio, or over the one with `id`. */
export function savePortfolio(plan: Plan, id?: string): Portfolio {
  const now = Date.now();
  const existing = id ? currentList().find((p) => p.id === id) : undefined;
  const portfolio: Portfolio = {
    ...cleanPlan(plan),
    id: existing?.id ?? newId(),
    savedAt: existing?.savedAt ?? now,
    updatedAt: now,
  };
  writeStorage("local", LIST_KEY, serializePortfolios(upsertPortfolio(currentList(), portfolio)));
  return portfolio;
}

export function deletePortfolio(id: string) {
  writeStorage("local", LIST_KEY, serializePortfolios(currentList().filter((p) => p.id !== id)));
}

// ---- the builder's draft ----

export type Method = "manual" | "rules" | "claude";
export type Step = 1 | 2 | 3;

export interface Draft {
  id: string;
  step: Step;
  method: Method;
  /** Ticked by hand. */
  manual: string[];
  rules: SelectionRules;
  goal: PickGoal;
  /** How many Claude should pick; null lets it decide. */
  count: number | null;
  pickNote: string;
  picks: PickResult | null;
  /** The stocks carried from step 1 into the proposal. */
  chosen: string[];
  monthly: number | null;
  starting: number;
  note: string;
  plan: Plan | null;
}

const symbols = z.array(z.string().min(1).max(12)).max(100);
const draftSchema = z.object({
  id: z.string(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  method: z.enum(["manual", "rules", "claude"]),
  manual: symbols,
  rules: z.object({
    minGrade: z.enum(["any", "Mixed", "Strong"]),
    cashOverDebt: z.boolean(),
    growing: z.boolean(),
    beatsMarket: z.boolean(),
    claudeOnly: z.boolean(),
    maxPerSector: z.number().int().min(1).nullable(),
    limit: z.number().int().min(1).max(MAX_HOLDINGS),
  }),
  goal: z.enum(["balanced", "growth", "defensive"]),
  count: z.number().int().min(1).max(MAX_HOLDINGS).nullable(),
  pickNote: z.string().max(1000),
  picks: z
    .object({
      picks: z.array(z.object({ symbol: z.string(), reason: z.string() })),
      summary: z.string(),
      source: z.enum(["claude", "demo"]),
      model: z.string().nullable(),
    })
    .nullable(),
  chosen: symbols,
  monthly: z.number().positive().nullable(),
  starting: z.number().min(0),
  note: z.string().max(1000),
  plan: planSchema.nullable(),
});

function freshDraft(): Draft {
  return {
    id: newId(),
    step: 1,
    method: "manual",
    manual: [],
    rules: DEFAULT_RULES,
    goal: "balanced",
    count: null,
    pickNote: "",
    picks: null,
    chosen: [],
    monthly: null,
    starting: 0,
    note: "",
    plan: null,
  };
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Draft) : null;
  } catch {
    return null;
  }
}

const getDraftRaw = () => readStorage("session", DRAFT_KEY);

/** The draft in this tab, saving a new one if there's none yet. */
function currentDraft(): Draft {
  const found = parseDraft(getDraftRaw());
  if (found) return found;
  const draft = freshDraft();
  writeStorageQuietly("session", DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

/** The builder's draft, or null until the browser has read it. Call `ensureDraft` once mounted. */
export function useDraft(): Draft | null {
  const raw = useSyncExternalStore(subscribeStorage, getDraftRaw, () => undefined);
  return useMemo(() => (raw === undefined ? null : parseDraft(raw)), [raw]);
}

/** Makes sure a draft is saved, so runs can tell which draft they belong to. */
export function ensureDraft() {
  if (!parseDraft(getDraftRaw())) {
    currentDraft();
    notifyStorage();
  }
}

export function updateDraft(change: Partial<Draft> | ((d: Draft) => Partial<Draft>)) {
  const d = currentDraft();
  const patch = typeof change === "function" ? change(d) : change;
  writeStorage("session", DRAFT_KEY, JSON.stringify({ ...d, ...patch }));
}

/** Throws the draft away and starts again. Runs still in flight finish without touching the new one. */
export function resetDraft() {
  writeStorageQuietly("session", DRAFT_KEY, JSON.stringify(freshDraft()));
  for (const kind of ["pick", "proposal"] as const) runErrors.delete(kind);
  notifyStorage();
}

// ---- Claude runs ----

export type RunKind = "pick" | "proposal";

interface RunError {
  draftId: string;
  message: string;
  keyRejected: boolean;
}

const running = new Map<RunKind, string>();
const runErrors = new Map<RunKind, RunError>();

/** True while a paid Claude run for a portfolio is in flight (reloading now would waste it). */
export function isPortfolioRunning(): boolean {
  return running.size > 0;
}

/** Whether a run for this draft is in flight, and its last error. */
export function useRun(kind: RunKind, draftId: string | undefined): { running: boolean; error: Omit<RunError, "draftId"> | null } {
  const snapshot = useSyncExternalStore(
    subscribeStorage,
    () => {
      const err = runErrors.get(kind);
      return `${running.get(kind) === draftId ? 1 : 0}${err && err.draftId === draftId ? JSON.stringify(err) : ""}`;
    },
    () => "0",
  );
  return useMemo(() => {
    const err = snapshot.length > 1 ? (JSON.parse(snapshot.slice(1)) as RunError) : null;
    return { running: snapshot[0] === "1", error: err && { message: err.message, keyRejected: err.keyRejected } };
  }, [snapshot]);
}

async function describe(err: unknown, activity: string) {
  const { describeAnalysisError, isKeyRejected } = await import("@/features/analysis/errors");
  return { message: describeAnalysisError(err, { activity, retry: "Try again." }), keyRejected: isKeyRejected(err) };
}

/** Runs `work` once per kind, landing its result in the draft that started it. */
function run<T>(kind: RunKind, activity: string, work: () => Promise<T>, land: (result: T) => Partial<Draft>) {
  if (running.has(kind)) return;
  const id = currentDraft().id;
  runErrors.delete(kind);
  running.set(kind, id);
  notifyStorage();
  work()
    .then((result) => {
      if (currentDraft().id === id) updateDraft(land(result));
    })
    .catch(async (err: unknown) => {
      console.error(`Portfolio ${kind} failed:`, err);
      runErrors.set(kind, { draftId: id, ...(await describe(err, activity)) });
    })
    .finally(() => {
      running.delete(kind);
      notifyStorage();
    });
}

/** Claude picks from the candidates (or, on demo data, the demo picks do). */
export function startPick(req: PickRequest, { apiKey, demo }: { apiKey: string | null; demo: boolean }) {
  if (demo) return updateDraft({ picks: demoPicks(req) });
  if (!apiKey) return;
  run(
    "pick",
    "picking stocks",
    async () => {
      const [{ pickWithClaude }, { createBrowserClient }] = await Promise.all([
        import("./claude"),
        import("@/features/analysis/claude"),
      ]);
      const subject = `${req.candidates.length} ${req.candidates.length === 1 ? "stock" : "stocks"}`;
      return logClaudeRun({ kind: "picks", subject }, createBrowserClient(apiKey), (client) => pickWithClaude(req, { client }));
    },
    (picks) => ({ picks }),
  );
}

/** Claude proposes the plan for the chosen stocks; on demo data, the score-weighted plan stands in. */
export function startProposal(
  req: { candidates: Candidate[]; monthly: number; starting: number; note: string },
  { apiKey, demo }: { apiKey: string | null; demo: boolean },
) {
  if (demo) return updateDraft({ plan: scoreWeightedPlan(req.candidates, { ...req, demo: true }) });
  if (!apiKey) return;
  run(
    "proposal",
    "building your proposal",
    async () => {
      const readings = await ensureReadings(req.candidates.map((c) => c.symbol));
      const [{ proposeWithClaude }, { createBrowserClient }] = await Promise.all([
        import("./claude"),
        import("@/features/analysis/claude"),
      ]);
      return logClaudeRun({ kind: "proposal", subject: req.candidates.map((c) => c.symbol).join(", ") }, createBrowserClient(apiKey), (client) =>
        proposeWithClaude({ ...req, readings }, { client }),
      );
    },
    (plan) => ({ plan }),
  );
}

/** The plan without Claude: weighted by score. */
export function applyScoreSplit(req: { candidates: Candidate[]; monthly: number; starting: number }) {
  runErrors.delete("proposal");
  updateDraft({ plan: scoreWeightedPlan(req.candidates, { ...req, demo: false }) });
}

// ---- DCA readings ----

/** Readings this recent aren't fetched again. */
export const READING_FRESH_MS = 60 * 60 * 1000;

const readingSchema = z.object({
  fetchedAt: z.number(),
  reading: z
    .object({ price: z.number(), high: z.number(), drawdown: z.number(), monthChange: z.number().nullable() })
    .nullable(),
});

function storedReading(symbol: string): { fetchedAt: number; reading: DcaReading | null } | null {
  const raw = readStorage("local", readingKey(symbol));
  if (!raw) return null;
  try {
    const parsed = readingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const readingsInFlight = new Map<string, Promise<void>>();
const readingFailures = new Set<string>();

function fetchReading(symbol: string): Promise<void> {
  const running = readingsInFlight.get(symbol);
  if (running) return running;
  readingFailures.delete(symbol);
  const run = fetch(`/api/stock/${encodeURIComponent(symbol)}/dca`, { credentials: "same-origin" })
    .then(async (res) => {
      const body = (await res.json().catch(() => null)) as { reading?: unknown } | null;
      if (!res.ok || !body) throw new Error(`Request failed (${res.status})`);
      const entry = readingSchema.parse({ fetchedAt: Date.now(), reading: body.reading ?? null });
      writeStorageQuietly("local", readingKey(symbol), JSON.stringify(entry));
    })
    .catch(() => {
      readingFailures.add(symbol);
    })
    .finally(() => {
      readingsInFlight.delete(symbol);
      notifyStorage();
    });
  readingsInFlight.set(symbol, run);
  return run;
}

/** Fetches the readings that are missing or stale, a few at a time, and returns them all (null where unavailable). */
export async function ensureReadings(list: readonly string[]): Promise<Map<string, DcaReading | null>> {
  const now = Date.now();
  const due = list.filter((s) => {
    const r = storedReading(s);
    return !r || now - r.fetchedAt >= READING_FRESH_MS;
  });
  let next = 0;
  const worker = async () => {
    while (next < due.length) await fetchReading(due[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(4, due.length) }, worker));
  return new Map(list.map((s) => [s, storedReading(s)?.reading ?? null]));
}

/**
 * Each symbol's DCA reading: a reading, null when there is none (or it
 * failed), or undefined while it loads. Fetches what's missing or stale.
 */
export function useReadings(list: readonly string[]): Map<string, DcaReading | null | undefined> {
  const key = list.join(",");
  const snapshot = useSyncExternalStore(
    subscribeStorage,
    () =>
      list
        .map((s) => `${readStorage("local", readingKey(s)) ?? ""}\u0001${readingsInFlight.has(s) ? 1 : 0}${readingFailures.has(s) ? 1 : 0}`)
        .join("\n"),
    () => "",
  );
  useEffect(() => {
    if (key) void ensureReadings(key.split(","));
  }, [key]);
  return useMemo(() => {
    const out = new Map<string, DcaReading | null | undefined>();
    const parts = snapshot ? snapshot.split("\n") : [];
    (key ? key.split(",") : []).forEach((s, i) => {
      const [, flags = "00"] = (parts[i] ?? "").split("\u0001");
      const stored = storedReading(s);
      out.set(s, stored ? stored.reading : flags[1] === "1" ? null : undefined);
    });
    return out;
  }, [snapshot, key]);
}
