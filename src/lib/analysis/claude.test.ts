import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnalysisError, analyzeWithClaude, continuationContent, type MessagesClient } from "./claude";
import { validSubmission } from "./test-fixtures";

type Block = Anthropic.Beta.BetaContentBlock;
type Msg = Anthropic.Beta.BetaMessage;

const subject = { symbol: "NVDA", name: "Nvidia", sector: "Information Technology", indexes: ["S&P 500", "Nasdaq-100"] };
const now = new Date("2026-10-12T12:00:00Z");

function message(stop_reason: string, content: unknown[], extra: Partial<Msg> = {}): Msg {
  return { model: "claude-opus-5-5", stop_reason, content, stop_details: null, ...extra } as unknown as Msg;
}

const search = (url: string): Block =>
  ({
    type: "web_search_tool_result",
    tool_use_id: "srv_1",
    content: [{ type: "web_search_result", title: "Result", url, encrypted_content: "", page_age: null }],
  }) as unknown as Block;

const submit = (input: unknown): Block => ({ type: "tool_use", id: "tu_1", name: "submit_scores", input }) as unknown as Block;

/** Replays canned responses and records every request. */
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

describe("analyzeWithClaude", () => {
  it("returns the submitted scores, with sources from the searches", async () => {
    const { client, requests } = fakeClient([
      message("tool_use", [
        search("https://example.com/a"),
        submit(validSubmission({ sources: [{ title: "A", url: "https://example.com/a" }] })),
      ]),
    ]);
    const a = await analyzeWithClaude(subject, { client, now });
    expect(a.metrics.secularTrend.score).toBe(10);
    expect(a.sources).toEqual([{ title: "A", url: "https://example.com/a" }]);
    expect(a.analyzedAt).toBe("2026-10-12T12:00:00.000Z");

    const req = requests[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.tool_choice).toBeUndefined(); // forced tool choice is a 400 on this model
    expect(req.tools?.map((t) => ("name" in t ? t.name : t.type))).toEqual(["web_search", "submit_scores"]);
  });

  it("resumes a paused server-tool turn and keeps its search results", async () => {
    const paused = [search("https://example.com/early")];
    const { client, requests } = fakeClient([
      message("pause_turn", paused),
      message("tool_use", [submit(validSubmission({ sources: [{ title: "E", url: "https://example.com/early" }] }))]),
    ]);
    const a = await analyzeWithClaude(subject, { client, now });
    expect(a.sources).toHaveLength(1);
    expect(requests[1].messages.at(-1)).toEqual({ role: "assistant", content: paused });
  });

  it("nudges once when Claude ends without submitting", async () => {
    const { client, requests } = fakeClient([
      message("end_turn", [{ type: "text", text: "Here is my view…" }]),
      message("tool_use", [submit(validSubmission())]),
    ]);
    await analyzeWithClaude(subject, { client, now });
    expect(requests[1].messages.at(-1)).toEqual({ role: "user", content: "Call submit_scores now with your scores." });
  });

  it("reports the model that answered after a fallback", async () => {
    const { client } = fakeClient([message("tool_use", [submit(validSubmission())], { model: "claude-opus-5" })]);
    expect((await analyzeWithClaude(subject, { client, now })).model).toBe("claude-opus-5");
  });

  it("fails clearly on a refusal", async () => {
    const { client } = fakeClient([
      message("refusal", [], { stop_details: { type: "refusal", category: "cyber", explanation: null } } as Partial<Msg>),
    ]);
    await expect(analyzeWithClaude(subject, { client, now })).rejects.toThrow(/declined to analyze NVDA \(cyber\)/);
  });

  it("fails on max_tokens and gives up after repeated non-answers", async () => {
    const truncated = fakeClient([message("max_tokens", [])]);
    await expect(analyzeWithClaude(subject, { client: truncated.client, now })).rejects.toBeInstanceOf(AnalysisError);

    const stalling = fakeClient(Array.from({ length: 4 }, () => message("end_turn", [{ type: "text", text: "…" }])));
    await expect(analyzeWithClaude(subject, { client: stalling.client, now })).rejects.toThrow(/didn't submit/);
  });

  it("rejects an invalid submission", async () => {
    const { client } = fakeClient([message("tool_use", [submit(validSubmission({ moat: { rationale: "x", score: 3 } }))])]);
    await expect(analyzeWithClaude(subject, { client, now })).rejects.toThrow();
  });
});

describe("continuationContent", () => {
  it("drops the declined model's blocks before the last fallback marker", () => {
    const content = [
      { type: "thinking" },
      { type: "fallback" },
      { type: "text", text: "kept" },
    ] as unknown as Block[];
    expect(continuationContent(content)).toEqual([{ type: "text", text: "kept" }]);
    expect(continuationContent(content.slice(2))).toEqual([{ type: "text", text: "kept" }]);
  });
});
