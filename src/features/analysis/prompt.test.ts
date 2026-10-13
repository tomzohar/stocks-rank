import { describe, expect, it } from "vitest";
import { QUALITATIVE_METRIC_IDS } from "@/features/scoring/metrics";
import { SUBMIT_TOOL, buildUserMessage, parseSubmission } from "./prompt";
import { validSubmission } from "./test-fixtures";

const meta = { model: "claude-opus-5-5", analyzedAt: "2026-10-12T00:00:00.000Z" };

describe("submit_scores tool", () => {
  it("requires every qualitative metric, a summary and sources", () => {
    expect(SUBMIT_TOOL.strict).toBe(true);
    expect(SUBMIT_TOOL.input_schema.required).toEqual([...QUALITATIVE_METRIC_IDS, "summary", "sources"]);
    expect(SUBMIT_TOOL.input_schema.additionalProperties).toBe(false);
  });
});

describe("buildUserMessage", () => {
  it("names the company and today's date", () => {
    const msg = buildUserMessage({ symbol: "NVDA", name: "Nvidia", sector: null, indexes: ["S&P 500"] }, "2026-10-12");
    expect(msg).toContain("Company: Nvidia");
    expect(msg).toContain("Ticker: NVDA");
    expect(msg).toContain("Today's date: 2026-10-12");
    expect(msg).not.toContain("Sector");
  });
});

describe("parseSubmission", () => {
  it("maps a valid submission to an analysis", () => {
    const a = parseSubmission(validSubmission(), [], meta);
    expect(a.metrics.moat).toEqual({ rationale: "Dominant platform with switching costs.", score: 10 });
    expect(a.metrics.talent.score).toBe(0);
    expect(a.model).toBe("claude-opus-5-5");
    expect(a.source).toBe("claude");
  });

  it("rejects scores other than 0, 5 or 10", () => {
    expect(() => parseSubmission(validSubmission({ moat: { rationale: "x", score: 7 } }), [], meta)).toThrow();
  });

  it("rejects a missing metric or empty rationale", () => {
    const missing: Record<string, unknown> = validSubmission();
    delete missing.ceo;
    expect(() => parseSubmission(missing, [], meta)).toThrow();
    expect(() => parseSubmission(validSubmission({ ceo: { rationale: "  ", score: 5 } }), [], meta)).toThrow();
  });

  it("keeps only sources that a search actually returned, deduplicated", () => {
    const searched = [
      { title: "Q3 results", url: "https://example.com/q3" },
      { title: "CEO profile", url: "https://news.example.org/ceo" },
    ];
    const a = parseSubmission(
      validSubmission({
        sources: [
          { title: "Q3 results", url: "https://example.com/q3/" }, // trailing slash still matches
          { title: "dup", url: "https://example.com/q3#section" },
          { title: "Invented", url: "https://made-up.example/page" },
          { title: "", url: "https://news.example.org/ceo" }, // falls back to the search title
        ],
      }),
      searched,
      meta,
    );
    expect(a.sources).toEqual([
      { title: "Q3 results", url: "https://example.com/q3" },
      { title: "CEO profile", url: "https://news.example.org/ceo" },
    ]);
  });
});
