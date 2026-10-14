import { describe, expect, it } from "vitest";
import type { Scores } from "@/features/scoring/score";
import { METRICS } from "@/features/scoring/metrics";
import { gradeFor } from "@/features/scorecard/model";
import { DEFAULT_RULES, selectByRules, type Candidate } from "./candidates";
import { demoPicks, scoreWeightedPlan } from "./heuristic";
import {
  allocate,
  balanceWeights,
  cleanPlan,
  formatDollars,
  isBalanced,
  parseAmount,
  parsePortfolios,
  serializePortfolios,
  shares,
  splitAmount,
  upsertPortfolio,
  type Plan,
  type Portfolio,
} from "./model";
import { monthlyBuys } from "./monthly";

/** A candidate whose every metric scores `score`, with overrides. */
function cand(symbol: string, ratio: number | null, extra: Partial<Candidate> & { score?: 0 | 5 | 10 } = {}): Candidate {
  const { score = 5, ...rest } = extra;
  const scores = Object.fromEntries(METRICS.map((m) => [m.id, score])) as Scores;
  return {
    symbol,
    name: `${symbol} Inc.`,
    sector: "Tech",
    price: 100,
    ratio,
    grade: gradeFor(ratio),
    claudeScored: true,
    scores: ratio === null ? null : scores,
    demo: false,
    ...rest,
  };
}

const plan = (over: Partial<Plan> = {}): Plan => ({
  name: "Test",
  monthly: 500,
  starting: 0,
  holdings: [
    { symbol: "AAA", weight: 50, role: "Core", note: "" },
    { symbol: "BBB", weight: 30, role: "Growth", note: "" },
    { symbol: "CCC", weight: 20, role: "Defensive", note: "" },
  ],
  summary: "",
  startingPlan: "",
  tips: [],
  source: "claude",
  model: "claude-opus-5-5",
  createdAt: "2026-10-14T00:00:00.000Z",
  ...over,
});

describe("money", () => {
  it("splits an amount into cents that add up exactly", () => {
    const parts = splitAmount(100, [1, 1, 1]);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(splitAmount(0, [1, 2])).toEqual([0, 0]);
  });

  it("allocates the starting and monthly amounts by weight", () => {
    const a = allocate(plan({ starting: 1000 }));
    expect(a.map((x) => x.monthly)).toEqual([250, 150, 100]);
    expect(a.map((x) => x.starting)).toEqual([500, 300, 200]);
  });

  it("treats unbalanced weights as proportions, and no weights as equal", () => {
    expect(shares([{ weight: 30 }, { weight: 10 }])).toEqual([0.75, 0.25]);
    expect(shares([{ weight: 0 }, { weight: 0 }])).toEqual([0.5, 0.5]);
  });

  it("balances weights to whole percents that add up to 100", () => {
    const b = balanceWeights([{ weight: 1 }, { weight: 1 }, { weight: 1 }]);
    expect(b.map((h) => h.weight)).toEqual([34, 33, 33]);
    expect(balanceWeights([{ weight: 0 }, { weight: 60 }, { weight: 30 }]).map((h) => h.weight)).toEqual([0, 67, 33]);
    expect(isBalanced(b)).toBe(true);
    expect(isBalanced([{ weight: 90 }])).toBe(false);
  });

  it("parses typed amounts", () => {
    expect(parseAmount("$1,250.50")).toBe(1250.5);
    expect(parseAmount(" 0 ")).toBe(0);
    expect(parseAmount(".5")).toBe(0.5);
    for (const bad of ["", "-5", "abc", "1e3", "1.2.3", "999999999999"]) expect(parseAmount(bad)).toBeNull();
  });

  it("formats whole dollars without cents", () => {
    expect(formatDollars(1250)).toBe("$1,250");
    expect(formatDollars(83.333)).toBe("$83.33");
  });
});

describe("selectByRules", () => {
  const list = [
    cand("HIGH", 0.9, { sector: "Tech" }),
    cand("HIGH2", 0.85, { sector: "Tech" }),
    cand("HIGH3", 0.8, { sector: "Tech" }),
    cand("MID", 0.5, { sector: "Health" }),
    cand("LOW", 0.2, { sector: "Energy" }),
    cand("NODATA", null),
  ];

  it("takes the best scores, capped per sector, and says why the rest are out", () => {
    const { picked, excluded } = selectByRules(list, { ...DEFAULT_RULES, maxPerSector: 2 });
    expect(picked.map((c) => c.symbol)).toEqual(["HIGH", "HIGH2", "MID"]);
    expect(excluded).toEqual(
      expect.arrayContaining([
        { symbol: "HIGH3", reason: "Already 2 from Tech" },
        { symbol: "LOW", reason: "Graded Weak, below Mixed" },
        { symbol: "NODATA", reason: "No market data yet" },
      ]),
    );
  });

  it("applies the must-haves and the limit", () => {
    const weak = [cand("A", 0.8, { score: 0 }), cand("B", 0.75), cand("C", 0.72, { claudeScored: false })];
    const r = selectByRules(weak, { ...DEFAULT_RULES, cashOverDebt: true, claudeOnly: true, maxPerSector: null, limit: 5 });
    expect(r.picked.map((c) => c.symbol)).toEqual(["B"]);
    expect(selectByRules(list, { ...DEFAULT_RULES, minGrade: "any", maxPerSector: null, limit: 2 }).picked).toHaveLength(2);
  });
});

describe("monthlyBuys", () => {
  const holdings = plan().holdings;
  const readings = new Map([
    ["AAA", { price: 70, high: 100, drawdown: 0.3, monthChange: 0 }],
    ["BBB", { price: 120, high: 120, drawdown: 0, monthChange: 0.25 }],
  ]);

  it("doubles a holding in the dip zone and halves one after a hot month", () => {
    const { buys, total } = monthlyBuys(holdings, 500, readings, { fit: false });
    expect(buys.map((b) => [b.symbol, b.base, b.multiplier, b.amount])).toEqual([
      ["AAA", 250, 2, 500],
      ["BBB", 150, 0.5, 75],
      ["CCC", 100, 1, 100],
    ]);
    expect(buys[2].known).toBe(false);
    expect(total).toBe(675);
  });

  it("keeps to the monthly amount when asked", () => {
    const { buys, total } = monthlyBuys(holdings, 500, readings, { fit: true });
    expect(total).toBe(500);
    expect(buys[0].amount).toBeCloseTo((500 * 500) / 675, 1);
  });
});

describe("storage", () => {
  const saved: Portfolio = { ...plan(), id: "p1", savedAt: 1, updatedAt: 2 };

  it("round-trips and skips corrupt entries", () => {
    const raw = JSON.stringify({ v: 1, portfolios: [saved, { id: "bad" }, saved] });
    expect(parsePortfolios(raw)).toEqual([saved]);
    expect(parsePortfolios(serializePortfolios([saved]))).toEqual([saved]);
    expect(parsePortfolios("{nope")).toEqual([]);
  });

  it("adds new portfolios first and replaces by id", () => {
    const other = { ...saved, id: "p2" };
    expect(upsertPortfolio([saved], other).map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(upsertPortfolio([saved, other], { ...saved, name: "Renamed" })[0].name).toBe("Renamed");
  });

  it("cleans a plan before saving", () => {
    const c = cleanPlan(plan({ name: "  ", tips: [" a ", "", "  "], summary: " s " }));
    expect(c.name).toBe("My Portfolio");
    expect(c.tips).toEqual(["a"]);
    expect(c.summary).toBe("s");
  });
});

describe("without Claude", () => {
  const list = [cand("A", 0.8, { sector: "Tech" }), cand("B", 0.4, { sector: "Health" }), cand("C", null)];

  it("weights by score, best first, with tips in the plan's own dollars", () => {
    const p = scoreWeightedPlan(list, { monthly: 600, starting: 900, demo: false });
    expect(p.holdings.map((h) => [h.symbol, h.weight, h.role])).toEqual([
      ["A", 50, "Core"],
      ["B", 25, "Growth"],
      ["C", 25, "Satellite"],
    ]);
    expect(p.source).toBe("score");
    expect(p.tips[0]).toContain("$300 into A");
    expect(p.startingPlan).toContain("$900");
    expect(scoreWeightedPlan(list, { monthly: 600, starting: 0, demo: true }).startingPlan).toBe("");
  });

  it("picks the best scores for demo data, labelled as such", () => {
    const r = demoPicks({ candidates: list, goal: "balanced", count: 2, note: "" });
    expect(r.picks.map((p) => p.symbol)).toEqual(["A", "B"]);
    expect(r.source).toBe("demo");
  });
});
