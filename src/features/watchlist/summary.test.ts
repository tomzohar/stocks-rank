import { describe, expect, it } from "vitest";
import { demoAnalysis } from "@/features/analysis/demo";
import { demoFundamentals } from "@/features/market-data/demo";
import { scoreQuantitative } from "@/features/scoring/score";
import { isFresh, parseQuote, QUOTE_FRESH_MS, summarizeStock, type QuoteSnapshot } from "./summary";

const now = Date.parse("2026-10-13T12:00:00Z");
const fundamentals = demoFundamentals("AAPL", "Apple", new Date(now));
const quote: QuoteSnapshot = { fetchedAt: now, fundamentals, scores: scoreQuantitative(fundamentals) };
const subject = { symbol: "AAPL", name: "Apple", sector: null, indexes: [] };

describe("parseQuote", () => {
  it("round-trips a saved snapshot", () => {
    expect(parseQuote(JSON.stringify(quote))).toEqual(quote);
  });

  it("ignores missing or malformed snapshots", () => {
    expect(parseQuote(null)).toBeNull();
    expect(parseQuote("nope")).toBeNull();
    expect(parseQuote(JSON.stringify({ ...quote, scores: { cashVsDebt: 7 } }))).toBeNull();
    expect(parseQuote(JSON.stringify({ fetchedAt: now }))).toBeNull();
  });

  it("is fresh for 15 minutes", () => {
    expect(isFresh(quote, now + QUOTE_FRESH_MS - 1)).toBe(true);
    expect(isFresh(quote, now + QUOTE_FRESH_MS)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
});

describe("summarizeStock", () => {
  it("totals market data alone until Claude has scored", () => {
    const s = summarizeStock(quote, null);
    const scored = Object.values(quote.scores).filter((v) => v !== null);
    expect(s.total.scoredCount).toBe(scored.length);
    expect(s.total.points).toBe(scored.reduce<number>((a, b) => a + (b ?? 0), 0));
    expect(s.claudeScored).toBe(false);
    expect(s.shape).toHaveLength(13);
    expect(s.shape.slice(7)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.demo).toBe(true);
  });

  it("adds Claude's cached scores", () => {
    const analysis = demoAnalysis(subject, new Date(now));
    const s = summarizeStock(quote, analysis);
    expect(s.claudeScored).toBe(true);
    expect(s.shape[7]).toBe(analysis.metrics.moat.score);
    expect(s.total.scoredCount).toBe(summarizeStock(quote, null).total.scoredCount + 6);
    expect(s.grade?.label).toMatch(/Strong|Mixed|Weak/);
  });
});
