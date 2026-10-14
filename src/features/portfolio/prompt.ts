// The two portfolio prompts, their strict submit tools, and validation of what
// comes back: Claude picking stocks from the watchlist, and Claude proposing
// weights and a monthly plan for the chosen ones. Pure — claude.ts calls the API.
import { AnalysisError } from "@/features/analysis/analysis-error";
import type { DcaReading } from "@/features/dca/reading";
import { METRICS, type MetricDefinition } from "@/features/scoring/metrics";
import { z } from "zod";
import type { Candidate } from "./candidates";
import { balanceWeights, formatDollars, MAX_HOLDINGS, ROLES, type Holding, type Plan, type Role } from "./model";

export const PICK_TOOL_NAME = "submit_picks";
export const PROPOSAL_TOOL_NAME = "submit_portfolio";

export type PickGoal = "balanced" | "growth" | "defensive";

export const PICK_GOALS: { id: PickGoal; label: string; text: string }[] = [
  { id: "balanced", label: "Balanced", text: "a balanced mix of quality and growth" },
  { id: "growth", label: "Growth", text: "long-term growth, accepting bigger swings" },
  { id: "defensive", label: "Defensive", text: "resilience: steadier businesses that hold up in downturns" },
];

export interface PickRequest {
  candidates: readonly Candidate[];
  goal: PickGoal;
  /** How many to pick; null lets Claude decide. */
  count: number | null;
  /** The investor's own words, optional. */
  note: string;
}

export interface PickResult {
  picks: { symbol: string; reason: string }[];
  summary: string;
  source: "claude" | "demo";
  model: string | null;
}

export interface ProposalRequest {
  candidates: readonly Candidate[];
  readings: ReadonlyMap<string, DcaReading | null>;
  monthly: number;
  starting: number;
  note: string;
}

const RUBRIC = `Each stock comes with its stocks-rank scorecard: 13 metrics scored 0, 5 or 10. Seven come from market data; six are judgement calls (moat, CEO, recession-proofing, secular trend, culture, talent) that Claude scored earlier and that may be missing. The grade is the share of available points over the metrics that have a score: Strong at 70% or more, Mixed at 40% or more, otherwise Weak.`;

const DCA_RULES = `The app runs four DCA rules on every holding:
1. Up 50% on the investor's average buy price: trim 10% of that position.
2. Up 100% on the average buy price: trim 20% of that position.
3. 20% or more under its 52-week high: make that stock's next buy 2×.
4. Up 20% or more over the past month: make that stock's next buy 0.5×.
Rules 3 and 4 multiply when both fire. The app can keep a month's total fixed by scaling the other buys to pay for a 2× buy.`;

export const PICK_SYSTEM_PROMPT = `You help an individual investor choose stocks for a long-term portfolio they will build by dollar-cost averaging (DCA): investing a fixed amount every month. They give you their watchlist.

${RUBRIC}

Choose the stocks that together make the best portfolio for the investor's goal:
- Favour quality: higher scores, especially cash over debt, operating margin and the judgement calls.
- Diversify: avoid piling into one sector or into several stocks that tend to move together, unless the watchlist leaves no choice.
- Pick the number asked for. If none is given, choose what the list supports, usually 4 to 10.
- A stock with no market data yet can't be judged; leave it out.

Use only the data given, plus widely known basics such as what each company sells. Each reason is one plain sentence naming the deciding evidence. The summary is two sentences on how the picks fit together. Be candid rather than promotional. When you're done, call ${PICK_TOOL_NAME} once.`;

export const PROPOSAL_SYSTEM_PROMPT = `You are a portfolio strategist. An individual investor has chosen stocks for a long-term portfolio they will build by dollar-cost averaging (DCA): a fixed amount every month, plus an optional starting amount.

${RUBRIC}

${DCA_RULES}

Each stock also says where it stands today against rules 3 and 4. Propose the portfolio:
- holdings: every stock given, each with a whole-percent target weight; the weights sum to 100. A weight of 0 leaves a stock out, and its rationale says why. Size by quality and conviction, keep any single stock at 35% or less unless fewer than four stocks carry weight, and keep sectors balanced. Give each a role: Core (steady and high quality, the base), Growth (faster growth, more swing), Defensive (holds up in downturns) or Satellite (small, higher-risk). The rationale is one or two plain sentences.
- startingPlan: how to put the starting amount to work, in dollars: all at once or spread over a few months, and which holdings first given today's readings. If the starting amount is 0, return an empty string.
- tips: three to five concrete tips on splitting the monthly amount each month, using the investor's dollar figures: the regular split, how rules 3 and 4 move money between holdings, what to do with the proceeds when a trim fires, and when to rebalance toward the target weights.
- name: a short, plain name for the portfolio, two to four words.
- summary: two or three sentences on the shape of the portfolio and its main risk.

Use only the data given; readings are as of the date given. This is education, not personal financial advice: don't promise returns. When you're done, call ${PROPOSAL_TOOL_NAME} once.`;

// ---- what Claude is told about each stock ----

const pct = (n: number) => `${Math.round(n * 100)}%`;

function scoreLine(c: Candidate, kind: MetricDefinition["kind"]): string {
  const parts = METRICS.filter((m) => m.kind === kind).map((m) => `${m.label} ${c.scores?.[m.id] ?? "n/a"}`);
  return parts.join(" · ");
}

function readingLine(r: DcaReading | null | undefined): string {
  if (!r) return "DCA rules today: no price reading";
  const month = r.monthChange === null ? "no one-month change yet" : `${r.monthChange >= 0 ? "up" : "down"} ${pct(Math.abs(r.monthChange))} over the past month`;
  return `DCA rules today: ${pct(r.drawdown)} under its 52-week high of ${formatDollars(r.high)}; ${month}`;
}

/** One stock's block in the user message. */
export function describeCandidate(c: Candidate, reading?: DcaReading | null): string {
  const head = `${c.symbol} — ${c.name}${c.sector ? ` (${c.sector})` : ""}`;
  if (c.ratio === null || !c.scores) return `${head}\n  No market data yet.`;
  const scored = Object.values(c.scores).filter((s) => s !== null).length;
  const lines = [
    head,
    `  Price ${c.price === null ? "n/a" : formatDollars(c.price)} · Grade ${c.grade?.label ?? "n/a"}, ${pct(c.ratio)} of available points (${scored} of ${METRICS.length} metrics scored)`,
    `  Market data: ${scoreLine(c, "quantitative")}`,
    `  Judgement calls: ${c.claudeScored ? scoreLine(c, "qualitative") : "not scored yet"}`,
  ];
  if (reading !== undefined) lines.push(`  ${readingLine(reading)}`);
  return lines.join("\n");
}

const noteBlock = (note: string) =>
  note.trim() ? `\n\nThe investor's own notes (their goals and constraints, in their words):\n"""\n${note.trim()}\n"""` : "";

export function buildPickMessage(req: PickRequest, today: string): string {
  const goal = PICK_GOALS.find((g) => g.id === req.goal)!;
  const count = req.count === null ? "Choose how many the list supports." : `Pick ${req.count} stocks.`;
  return `Today's date: ${today}
Goal: ${goal.text}
${count}${noteBlock(req.note)}

The watchlist (${req.candidates.length} stocks):

${req.candidates.map((c) => describeCandidate(c)).join("\n\n")}`;
}

export function buildProposalMessage(req: ProposalRequest, today: string): string {
  return `Today's date: ${today}
Monthly DCA amount: ${formatDollars(req.monthly)}
Starting amount: ${formatDollars(req.starting)}${noteBlock(req.note)}

The chosen stocks (${req.candidates.length}):

${req.candidates.map((c) => describeCandidate(c, req.readings.get(c.symbol) ?? null)).join("\n\n")}`;
}

// ---- the tools ----

/** Strict client tool for the picks; symbols are limited to the watchlist. Never executed. */
export function pickTool(symbols: readonly string[]) {
  return {
    name: PICK_TOOL_NAME,
    description: "Submit the stocks picked from the watchlist, each with a one-sentence reason, and a short summary.",
    strict: true,
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        picks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            // Reason first, so the pick follows from the evidence.
            properties: { reason: { type: "string" }, symbol: { type: "string", enum: [...symbols] } },
            required: ["reason", "symbol"],
          },
        },
        summary: { type: "string" },
      },
      required: ["picks", "summary"],
    },
  };
}

/** Strict client tool for the proposal; symbols are limited to the chosen stocks. Never executed. */
export function proposalTool(symbols: readonly string[]) {
  return {
    name: PROPOSAL_TOOL_NAME,
    description: "Submit the portfolio proposal: a weight, role and rationale for every stock, the starting plan, monthly tips, a name and a summary.",
    strict: true,
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        holdings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              symbol: { type: "string", enum: [...symbols] },
              rationale: { type: "string" },
              role: { type: "string", enum: [...ROLES] },
              weight: { type: "integer" },
            },
            required: ["symbol", "rationale", "role", "weight"],
          },
        },
        startingPlan: { type: "string" },
        tips: { type: "array", items: { type: "string" } },
        name: { type: "string" },
        summary: { type: "string" },
      },
      required: ["holdings", "startingPlan", "tips", "name", "summary"],
    },
  };
}

// ---- validating the answers ----

const pickSchema = z.object({
  picks: z.array(z.object({ symbol: z.string(), reason: z.string().trim() })),
  summary: z.string().trim(),
});

/** Keeps picks from the watchlist only, once each. */
export function parsePicks(input: unknown, allowed: readonly string[], model: string): PickResult {
  const parsed = pickSchema.parse(input);
  const ok = new Set(allowed);
  const seen = new Set<string>();
  const picks = parsed.picks
    .map((p) => ({ symbol: p.symbol.trim().toUpperCase(), reason: p.reason }))
    .filter((p) => ok.has(p.symbol) && !seen.has(p.symbol) && seen.add(p.symbol))
    .slice(0, MAX_HOLDINGS);
  if (!picks.length) throw new AnalysisError("Claude didn't pick any stocks from your watchlist.");
  return { picks, summary: parsed.summary, source: "claude", model };
}

const proposalSchema = z.object({
  holdings: z.array(
    z.object({ symbol: z.string(), rationale: z.string().trim(), role: z.enum(ROLES), weight: z.number() }),
  ),
  startingPlan: z.string().trim(),
  tips: z.array(z.string().trim()),
  name: z.string().trim(),
  summary: z.string().trim(),
});

/**
 * Turns submit_portfolio input into an editable plan: only the chosen stocks,
 * once each, every chosen stock present (any Claude skipped at 0%), and
 * whole-percent weights that add up to 100, largest first.
 */
export function parseProposal(
  input: unknown,
  req: Pick<ProposalRequest, "candidates" | "monthly" | "starting">,
  meta: { model: string; createdAt: string },
): Plan {
  const parsed = proposalSchema.parse(input);
  const chosen = req.candidates.map((c) => c.symbol);
  const bySymbol = new Map<string, Holding>();
  for (const h of parsed.holdings) {
    const symbol = h.symbol.trim().toUpperCase();
    if (!chosen.includes(symbol) || bySymbol.has(symbol)) continue;
    const weight = Number.isFinite(h.weight) ? Math.max(0, Math.min(100, Math.round(h.weight))) : 0;
    bySymbol.set(symbol, { symbol, weight, role: h.role as Role, note: h.rationale });
  }
  for (const symbol of chosen) {
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, { symbol, weight: 0, role: "Satellite", note: "Claude left this one out." });
  }
  const holdings = balanceWeights([...bySymbol.values()]).sort((a, b) => b.weight - a.weight);
  return {
    name: parsed.name.slice(0, 80) || "My Portfolio",
    monthly: req.monthly,
    starting: req.starting,
    holdings,
    summary: parsed.summary,
    startingPlan: req.starting > 0 ? parsed.startingPlan : "",
    tips: parsed.tips.filter(Boolean).slice(0, 8),
    source: "claude",
    model: meta.model,
    createdAt: meta.createdAt,
  };
}
