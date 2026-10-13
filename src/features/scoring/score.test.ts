import { describe, expect, it } from "vitest";
import { MAX_TOTAL_SCORE, METRICS } from "./metrics";
import {
  scoreCashVsDebt,
  scoreFiveYearVsSp500,
  scoreInstitutionalOwnership,
  scoreOperatingMargin,
  scoreQuantitative,
  scoreRevenueGrowth,
  scoreScalability,
  scoreShortInterest,
  totalScore,
} from "./score";

describe("metric catalogue", () => {
  it("has the 13 metrics in the specified order", () => {
    expect(METRICS.map((m) => m.label)).toEqual([
      "Cash > Debt",
      "Revenue growth",
      "Operating margin",
      "Short interest",
      "Institutional ownership",
      "Scalability",
      "Share price, 5 years vs S&P 500",
      "Moat",
      "CEO",
      "Recession proof",
      "Secular trend",
      "Culture / mission",
      "Talent",
    ]);
    expect(MAX_TOTAL_SCORE).toBe(130);
  });
});

describe("1. Cash > Debt", () => {
  it.each([
    [100, 200, 0], // debt larger
    [100, 100, 0], // equal is not "cash larger"
    [150, 100, 5],
    [199, 100, 5],
    [200, 100, 10], // exactly 2x
    [50, 0, 10], // no debt
  ])("cash %d, debt %d → %d", (cash, debt, expected) => {
    expect(scoreCashVsDebt(cash, debt)).toBe(expected);
  });

  it("is unscored without data", () => {
    expect(scoreCashVsDebt(null, 100)).toBeNull();
    expect(scoreCashVsDebt(100, undefined)).toBeNull();
    expect(scoreCashVsDebt(NaN, 1)).toBeNull();
  });
});

describe("2. Revenue growth", () => {
  it.each([
    [-0.05, 0],
    [0.0999, 0],
    [0.1, 5],
    [0.1999, 5],
    [0.2, 10],
    [1.5, 10],
  ])("%d → %d", (g, expected) => expect(scoreRevenueGrowth(g)).toBe(expected));
  it("is unscored without data", () => expect(scoreRevenueGrowth(null)).toBeNull());
});

describe("3. Operating margin", () => {
  it.each([
    [-0.3, 0],
    [0.0999, 0],
    [0.1, 5],
    [0.2499, 5],
    [0.25, 10],
  ])("%d → %d", (m, expected) => expect(scoreOperatingMargin(m)).toBe(expected));
});

describe("4. Short interest (lower is better)", () => {
  it.each([
    [0.01, 10],
    [0.0499, 10],
    [0.05, 5],
    [0.0999, 5],
    [0.1, 0],
    [0.3, 0],
  ])("%d of float → %d", (s, expected) => expect(scoreShortInterest(s)).toBe(expected));
});

describe("5. Institutional ownership", () => {
  it.each([
    [0.1, 0],
    [0.2999, 0],
    [0.3, 5],
    [0.6, 5], // "above 60%" is strictly above
    [0.6001, 10],
    [0.95, 10],
  ])("%d → %d", (h, expected) => expect(scoreInstitutionalOwnership(h)).toBe(expected));
});

describe("6. Scalability", () => {
  it("scores 10 only when revenue outgrows expenses", () => {
    expect(scoreScalability(0.2, 0.1)).toBe(10);
    expect(scoreScalability(0.1, 0.1)).toBe(0);
    expect(scoreScalability(0.05, 0.12)).toBe(0);
    expect(scoreScalability(-0.02, -0.08)).toBe(10); // shrinking, but costs shrink faster
  });
  it("is unscored without both inputs", () => expect(scoreScalability(0.2, null)).toBeNull());
});

describe("7. Five-year share price vs S&P 500", () => {
  it.each([
    [0.5, 0.65, 0], // behind the index
    [0.7, 0.65, 0], // ahead, but by under 10 points
    [0.75, 0.65, 5], // exactly 10 points
    [0.8, 0.65, 5],
    [0.85, 0.65, 10], // exactly 20 points
    [3.0, 0.65, 10],
    [0.3, 0.1, 10], // float noise: 0.3 - 0.1 = 0.19999…
    [-0.1, -0.3, 10], // both down, stock 20 points better
  ])("stock %d vs index %d → %d", (s, i, expected) => expect(scoreFiveYearVsSp500(s, i)).toBe(expected));
  it("is unscored without 5 years of history", () => expect(scoreFiveYearVsSp500(null, 0.6)).toBeNull());
});

describe("scoreQuantitative", () => {
  it("scores all seven data-driven metrics", () => {
    expect(
      scoreQuantitative({
        totalCash: 300,
        totalDebt: 100,
        revenueGrowth: 0.15,
        expenseGrowth: 0.1,
        operatingMargin: 0.3,
        shortPercentOfFloat: 0.07,
        institutionalOwnership: 0.2,
        fiveYearReturn: 1.0,
        sp500FiveYearReturn: 0.9,
      }),
    ).toEqual({
      cashVsDebt: 10,
      revenueGrowth: 5,
      operatingMargin: 10,
      shortInterest: 5,
      institutionalOwnership: 0,
      scalability: 10,
      fiveYearVsSp500: 5,
    });
  });
});

describe("totalScore", () => {
  it("sums scored metrics and ignores unscored ones", () => {
    expect(totalScore({ cashVsDebt: 10, revenueGrowth: 5, moat: 0, ceo: null })).toEqual({
      points: 15,
      outOf: 30,
      scoredCount: 3,
      ratio: 0.5,
    });
  });
  it("has no ratio when nothing is scored", () => {
    expect(totalScore({}).ratio).toBeNull();
  });
});
