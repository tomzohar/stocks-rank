import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnalysisError } from "@/features/analysis/analysis-error";
import type { MessagesClient } from "@/features/analysis/claude";
import { METRICS } from "@/features/scoring/metrics";
import type { Scores } from "@/features/scoring/score";
import type { Candidate } from "./candidates";
import { pickWithClaude, proposeWithClaude } from "./claude";
import { buildProposalMessage, describeCandidate, parsePicks, parseProposal, proposalTool } from "./prompt";

type Msg = Anthropic.Beta.BetaMessage;

const now = new Date("2026-10-14T12:00:00Z");

const cand = (symbol: string, ratio: number | null = 0.8): Candidate => ({
  symbol,
  name: `${symbol} Corp`,
  sector: "Information Technology",
  price: 123.45,
  ratio,
  grade: ratio === null ? null : { label: "Strong", tone: "good" },
  claudeScored: false,
  scores: ratio === null ? null : (Object.fromEntries(METRICS.map((m) => [m.id, m.kind === "quantitative" ? 10 : null])) as Scores),
  demo: false,
});

function message(stop_reason: string, content: unknown[]): Msg {
  return { model: "claude-opus-5-5", stop_reason, content, stop_details: null } as unknown as Msg;
}
const call = (name: string, input: unknown) => ({ type: "tool_use", id: "tu_1", name, input });

function fakeClient(responses: Msg[]) {
  const requests: Parameters<MessagesClient["beta"]["messages"]["stream"]>[0][] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        stream(params) {
          requests.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("unexpected request");
          return { finalMessage: async () => next };
        },
      },
    },
  };
  return { client, requests };
}

describe("pickWithClaude", () => {
  it("keeps watchlist picks only, once each, and limits the tool to the watchlist", async () => {
    const { client, requests } = fakeClient([
      message("tool_use", [
        call("submit_picks", {
          picks: [
            { symbol: "AAA", reason: "Best scorecard." },
            { symbol: "ZZZ", reason: "Not on the list." },
            { symbol: "aaa", reason: "Again." },
            { symbol: "BBB", reason: "Different sector." },
          ],
          summary: "Two quality names.",
        }),
      ]),
    ]);
    const r = await pickWithClaude({ candidates: [cand("AAA"), cand("BBB")], goal: "growth", count: 2, note: "" }, { client, now });
    expect(r.picks.map((p) => p.symbol)).toEqual(["AAA", "BBB"]);
    expect(r.source).toBe("claude");

    const req = requests[0];
    expect(req.tool_choice).toBeUndefined();
    expect(req.output_config).toEqual({ effort: "medium" });
    expect(req.tools).toHaveLength(1);
    const schema = JSON.stringify(req.tools?.[0]);
    expect(schema).toContain('"enum":["AAA","BBB"]');
    const user = req.messages[0].content as string;
    expect(user).toContain("Pick 2 stocks.");
    expect(user).toContain("long-term growth");
  });

  it("nudges once when Claude answers in prose, then gives up", async () => {
    const prose = message("end_turn", [{ type: "text", text: "Here are my thoughts." }]);
    const { client, requests } = fakeClient([prose, message("end_turn", [{ type: "text", text: "Still prose." }])]);
    await expect(
      pickWithClaude({ candidates: [cand("AAA")], goal: "balanced", count: null, note: "" }, { client, now }),
    ).rejects.toBeInstanceOf(AnalysisError);
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.at(-1)).toEqual({ role: "user", content: "Call submit_picks now with your answer." });
  });

  it("refuses an answer with no watchlist stocks in it", () => {
    expect(() => parsePicks({ picks: [{ symbol: "ZZZ", reason: "x" }], summary: "" }, ["AAA"], "m")).toThrow(AnalysisError);
  });
});

describe("proposeWithClaude", () => {
  const req = {
    candidates: [cand("AAA"), cand("BBB"), cand("CCC")],
    readings: new Map([["AAA", { price: 80, high: 100, drawdown: 0.2, monthChange: -0.05 }]]),
    monthly: 500,
    starting: 1000,
    note: "Long horizon.",
  };

  it("returns an editable plan: chosen stocks only, all present, weights summing to 100", async () => {
    const { client, requests } = fakeClient([
      message("tool_use", [
        call("submit_portfolio", {
          holdings: [
            { symbol: "AAA", rationale: "Anchor.", role: "Core", weight: 60 },
            { symbol: "BBB", rationale: "Growth.", role: "Growth", weight: 30 },
            { symbol: "QQQ", rationale: "Not chosen.", role: "Core", weight: 50 },
          ],
          startingPlan: "Put $600 into AAA now.",
          tips: ["Split $500 by weight.", ""],
          name: "Quality Core",
          summary: "Concentrated in tech.",
        }),
      ]),
    ]);
    const plan = await proposeWithClaude(req, { client, now });
    expect(plan.holdings.map((h) => [h.symbol, h.weight])).toEqual([
      ["AAA", 67],
      ["BBB", 33],
      ["CCC", 0],
    ]);
    expect(plan.holdings[2].note).toBe("Claude left this one out.");
    expect(plan).toMatchObject({ name: "Quality Core", monthly: 500, starting: 1000, source: "claude", tips: ["Split $500 by weight."] });
    expect(plan.createdAt).toBe(now.toISOString());

    const user = requests[0].messages[0].content as string;
    expect(user).toContain("Monthly DCA amount: $500");
    expect(user).toContain("20% under its 52-week high of $100; down 5% over the past month");
    expect(user).toContain("DCA rules today: no price reading");
    expect(user).toContain('"""\nLong horizon.\n"""');
  });

  it("spreads evenly when Claude gives every stock 0%, and drops the starting plan with no starting amount", () => {
    const p = parseProposal(
      {
        holdings: [{ symbol: "AAA", rationale: "", role: "Core", weight: 0 }],
        startingPlan: "Ignore me.",
        tips: [],
        name: "",
        summary: "",
      },
      { ...req, starting: 0 },
      { model: "m", createdAt: "t" },
    );
    expect(p.holdings.map((h) => h.weight)).toEqual([34, 33, 33]);
    expect(p.startingPlan).toBe("");
    expect(p.name).toBe("My Portfolio");
  });
});

describe("prompt", () => {
  it("describes a stock without data plainly", () => {
    expect(describeCandidate(cand("NEW", null))).toBe("NEW — NEW Corp (Information Technology)\n  No market data yet.");
  });

  it("lists every metric and marks missing judgement calls", () => {
    const text = describeCandidate(cand("AAA"));
    expect(text).toContain("Cash > Debt 10");
    expect(text).toContain("Judgement calls: not scored yet");
    expect(text).toContain("7 of 13 metrics scored");
  });

  it("limits the proposal's symbols and roles", () => {
    const tool = proposalTool(["AAA"]);
    const item = tool.input_schema.properties.holdings.items.properties;
    expect(item.symbol.enum).toEqual(["AAA"]);
    expect(item.role.enum).toEqual(["Core", "Growth", "Defensive", "Satellite"]);
    expect(buildProposalMessage({ ...{ candidates: [], readings: new Map(), monthly: 1, starting: 0, note: "" } }, "2026-10-14")).not.toContain(
      "notes",
    );
  });
});
