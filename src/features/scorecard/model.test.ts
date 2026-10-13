import { describe, expect, it } from "vitest";
import { demoAnalysis } from "@/features/analysis/demo";
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import { scoreQuantitative } from "@/features/scoring/score";
import { buildScorecard, gradeFor } from "./model";
import { PRESENTERS } from "./presenters";

const f: StockFundamentals = {
  symbol: "TEST",
  name: "Test Corp",
  currency: "USD",
  price: 100,
  financialCurrency: "USD",
  totalCash: 30e9,
  totalDebt: 10e9, // 3× → 10
  revenueGrowth: 0.15, // → 5
  expenseGrowth: 0.1, // revenue faster → 10
  growthPeriod: "FY2024 → FY2025",
  operatingMargin: 0.05, // → 0
  shortPercentOfFloat: 0.02, // → 10
  institutionalOwnership: 0.6, // exactly 60% → 5 ("above 60%")
  fiveYearReturn: null, // recent IPO → n/a
  sp500FiveYearReturn: 0.8,
  asOf: "2026-10-01T00:00:00.000Z",
  source: "yahoo",
};
const quantitative = scoreQuantitative(f);
const subject = { symbol: "TEST", name: "Test Corp", sector: null, indexes: [] };

describe("buildScorecard", () => {
  it("scores market data and marks Claude's metrics by analysis state", () => {
    const m = buildScorecard({ fundamentals: f, quantitative, analysis: { status: "needs-key" } });
    expect(m.rows).toHaveLength(13);
    expect(m.rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(m.quantitative).toMatchObject({ points: 40, max: 70, scoredCount: 6 });
    expect(m.qualitative).toMatchObject({ points: 0, max: 60, scoredCount: 0 });
    expect(m.rows.find((r) => r.metric.id === "fiveYearVsSp500")).toMatchObject({ state: "no-data", score: null, tone: "neutral" });
    expect(m.rows.filter((r) => r.metric.kind === "qualitative").every((r) => r.state === "unscored")).toBe(true);
    expect(buildScorecard({ fundamentals: f, quantitative, analysis: { status: "pending" } }).rows[12].state).toBe("pending");
  });

  it("adds Claude's scores, rationale and rubric verdicts when ready", () => {
    const analysis = demoAnalysis(subject, new Date("2026-10-01"));
    const m = buildScorecard({ fundamentals: f, quantitative, analysis: { status: "ready", analysis } });
    const moat = m.rows.find((r) => r.metric.id === "moat")!;
    expect(moat.score).toBe(analysis.metrics.moat.score);
    expect(moat.rationale).toBe(analysis.metrics.moat.rationale);
    expect(moat.verdict).toBe(moat.metric.criteria[moat.score!]);
    expect(m.total.scoredCount).toBe(12);
    expect(m.tiers.ten + m.tiers.five + m.tiers.zero + m.tiers.none).toBe(13);
  });

  it("lists strengths and watch-outs with plain-language takeaways", () => {
    const m = buildScorecard({ fundamentals: f, quantitative, analysis: { status: "needs-key" } });
    expect(m.strengths.map((c) => c.text)).toEqual([
      "Cash covers debt 3.0× over",
      "2% of the float is sold short",
      "Revenue (+15.0%) outgrew expenses (+10.0%)",
    ]);
    expect(m.watchOuts.map((c) => c.text)).toEqual(["Keeps 5% of revenue as operating profit"]);
  });

  it("lights the band the score earned, even on a cut-off", () => {
    const m = buildScorecard({ fundamentals: f, quantitative, analysis: { status: "needs-key" } });
    const inst = m.rows.find((r) => r.metric.id === "institutionalOwnership")!;
    expect(inst.score).toBe(5);
    expect(inst.meter?.bands[inst.meter.active!].tone).toBe("warning");
  });
});

describe("presenters", () => {
  it("handles a debt-free balance sheet", () => {
    const noDebt = { ...f, totalDebt: 0 };
    expect(PRESENTERS.cashVsDebt.figure(noDebt).main).toBe("No debt");
    expect(PRESENTERS.cashVsDebt.takeaway(noDebt)).toBe("No debt on the balance sheet");
    expect(PRESENTERS.cashVsDebt.meter(noDebt, 10)?.value).toBeGreaterThan(4);
  });

  it("phrases the 5-year comparison both ways", () => {
    expect(PRESENTERS.fiveYearVsSp500.takeaway({ ...f, fiveYearReturn: 1.25 })).toBe("Beat the S&P 500 by 45 pts over 5 years");
    expect(PRESENTERS.fiveYearVsSp500.takeaway({ ...f, fiveYearReturn: 0.5 })).toBe("Trailed the S&P 500 by 30 pts over 5 years");
    expect(PRESENTERS.fiveYearVsSp500.meter({ ...f, fiveYearReturn: 1.25 }, 10)?.value).toBeCloseTo(45);
  });
});

describe("gradeFor", () => {
  it("grades the share of points earned", () => {
    expect(gradeFor(null)).toBeNull();
    expect(gradeFor(0.7)?.label).toBe("Strong");
    expect(gradeFor(0.5)?.label).toBe("Mixed");
    expect(gradeFor(0.1)?.label).toBe("Weak");
  });
});
