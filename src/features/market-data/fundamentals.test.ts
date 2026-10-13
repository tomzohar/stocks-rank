import { describe, expect, it } from "vitest";
import { latestAnnualGrowth, periodReturn, yearsAgo } from "./fundamentals";

const fy = (year: number, fields: object) => ({ date: new Date(Date.UTC(year, 8, 30)), ...fields });

describe("latestAnnualGrowth", () => {
  it("compares the two most recent fiscal years, whatever the input order", () => {
    const g = latestAnnualGrowth([
      fy(2025, { totalRevenue: 130, totalExpenses: 99 }),
      fy(2023, { totalRevenue: 80, totalExpenses: 70 }),
      fy(2024, { totalRevenue: 100, totalExpenses: 90 }),
    ]);
    expect(g.revenueGrowth).toBeCloseTo(0.3);
    expect(g.expenseGrowth).toBeCloseTo(0.1);
    expect(g.period).toBe("FY2024 → FY2025");
  });

  it("derives expenses from revenue minus operating income when not reported", () => {
    const g = latestAnnualGrowth([
      fy(2024, { totalRevenue: 100, operatingIncome: 20 }), // expenses 80
      fy(2025, { totalRevenue: 110, operatingIncome: 10 }), // expenses 100
    ]);
    expect(g.expenseGrowth).toBeCloseTo(0.25);
  });

  it("skips years with no revenue (e.g. a padded, not-yet-reported year)", () => {
    const g = latestAnnualGrowth([
      fy(2023, { totalRevenue: 50 }),
      fy(2024, { totalRevenue: 100 }),
      fy(2025, { totalRevenue: null }),
    ]);
    expect(g.revenueGrowth).toBeCloseTo(1);
    expect(g.period).toBe("FY2023 → FY2024");
  });

  it("returns nulls with fewer than two years", () => {
    expect(latestAnnualGrowth([fy(2025, { totalRevenue: 10 })])).toEqual({
      revenueGrowth: null,
      expenseGrowth: null,
      period: null,
    });
  });

  it("can't compute growth from a zero base", () => {
    const g = latestAnnualGrowth([fy(2024, { totalRevenue: 0 }), fy(2025, { totalRevenue: 5 })]);
    expect(g.revenueGrowth).toBeNull();
  });
});

describe("periodReturn", () => {
  const from = new Date(Date.UTC(2021, 9, 12));
  const month = (y: number, m: number, adjclose: number | null, close?: number) => ({
    date: new Date(Date.UTC(y, m, 1)),
    adjclose,
    close,
  });

  it("uses adjusted closes from the first to the last bar", () => {
    expect(periodReturn([month(2026, 9, 300), month(2021, 10, 100), month(2024, 0, 50)], from)).toBeCloseTo(2);
  });

  it("falls back to close and skips empty bars", () => {
    expect(periodReturn([month(2021, 10, null, 100), month(2026, 9, null), month(2026, 8, null, 150)], from)).toBeCloseTo(0.5);
  });

  it("is null when history starts well after the window (recent IPO)", () => {
    expect(periodReturn([month(2024, 5, 10), month(2026, 9, 20)], from)).toBeNull();
  });

  it("is null with fewer than two prices", () => {
    expect(periodReturn([month(2021, 10, 100)], from)).toBeNull();
  });
});

describe("yearsAgo", () => {
  it("steps back whole years in UTC", () => {
    expect(yearsAgo(5, new Date("2026-10-12T20:00:00Z")).toISOString()).toBe("2021-10-12T20:00:00.000Z");
  });
});
