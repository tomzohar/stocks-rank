import { describe, expect, it } from "vitest";
import { ANALYSIS_TTL_MS, keyHint, looksLikeAnthropicKey, parseStoredAnalysis } from "./browser-store";
import { demoAnalysis } from "./demo";

const subject = { symbol: "AAPL", name: "Apple", sector: null, indexes: ["S&P 500"] };
const analysis = demoAnalysis(subject, new Date("2026-10-01T00:00:00Z"));
const now = Date.parse("2026-10-13T00:00:00Z");

describe("API key helpers", () => {
  it("recognises Anthropic key shapes", () => {
    expect(looksLikeAnthropicKey("sk-ant-api03-" + "a".repeat(40))).toBe(true);
    expect(looksLikeAnthropicKey("  sk-ant-api03-" + "a".repeat(40) + "  ")).toBe(true);
    expect(looksLikeAnthropicKey("sk-proj-abc")).toBe(false);
    expect(looksLikeAnthropicKey("")).toBe(false);
  });

  it("shows only the last four characters", () => {
    expect(keyHint("sk-ant-api03-secretsecretsecret-WXYZ")).toBe("sk-ant-…WXYZ");
  });
});

describe("parseStoredAnalysis", () => {
  const stored = (savedAt: number, a: unknown = analysis) => JSON.stringify({ savedAt, analysis: a });

  it("returns a fresh cached analysis with when it expires", () => {
    const savedAt = now - 1000;
    expect(parseStoredAnalysis(stored(savedAt), now)).toEqual({
      analysis,
      savedAt,
      expiresAt: savedAt + 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("expires entries exactly one week after they were saved", () => {
    expect(parseStoredAnalysis(stored(now - ANALYSIS_TTL_MS + 1), now)).not.toBeNull();
    expect(parseStoredAnalysis(stored(now - ANALYSIS_TTL_MS), now)).toBeNull();
  });

  it("ignores missing, corrupt or malformed entries", () => {
    expect(parseStoredAnalysis(null, now)).toBeNull();
    expect(parseStoredAnalysis("{not json", now)).toBeNull();
    expect(parseStoredAnalysis(stored(now, { ...analysis, metrics: {} }), now)).toBeNull();
  });
});
