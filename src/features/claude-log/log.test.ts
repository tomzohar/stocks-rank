import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { analyzeWithClaude, type MessagesClient } from "@/features/analysis/claude";
import { appendRun, finishRun, MAX_RUNS, parseRunLog, runIssues, searchRemarks, serverEvent, summarizeMessage, type RunLog } from "./log";
import { recordingClient } from "./store";

type Msg = Anthropic.Beta.BetaMessage;

function message(stop_reason: string, content: unknown[], usage: Record<string, unknown> = {}): Msg {
  return {
    model: "claude-opus-5-5",
    stop_reason,
    content,
    stop_details: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 }, ...usage },
  } as unknown as Msg;
}

const search = (id: string, query: string) => ({ type: "server_tool_use", id, name: "web_search", input: { query } });
const results = (id: string, n: number) => ({
  type: "web_search_tool_result",
  tool_use_id: id,
  content: Array.from({ length: n }, (_, i) => ({ type: "web_search_result", title: `T${i}`, url: `https://example.com/${i}` })),
});
const searchError = (id: string, error_code: string) => ({
  type: "web_search_tool_result",
  tool_use_id: id,
  content: { type: "web_search_tool_result_error", error_code },
});

const start = { id: "r1", kind: "scoring" as const, subject: "AAPL", startedAt: "2026-10-14T12:00:00.000Z" };

describe("summarizeMessage", () => {
  it("pairs each search with its results or error code, and keeps usage", () => {
    const r = summarizeMessage(
      message("end_turn", [
        search("s1", "Apple CEO 2026"),
        results("s1", 8),
        search("s2", "Apple layoffs"),
        searchError("s2", "max_uses_exceeded"),
        { type: "server_tool_use", id: "c1", name: "code_execution", input: { code: "print(results)" } },
        { type: "code_execution_tool_result", tool_use_id: "c1", content: { type: "code_execution_result", return_code: 1, stderr: "KeyError: 'x'", stdout: "", content: [] } },
        { type: "text", text: "Web search was limited, so I relied on what I know. Apple is strong." },
      ]),
      { ms: 1234, requestId: "req_1" },
    );
    expect(r.steps).toEqual([
      { tool: "web_search", input: "Apple CEO 2026", result: "8 results", ok: true },
      { tool: "web_search", input: "Apple layoffs", result: "error: max_uses_exceeded", ok: false },
      { tool: "code_execution", input: "print(results)", result: "exit 1: KeyError: 'x'", ok: false },
    ]);
    expect(r.usage).toEqual({ input: 1000, output: 200, cacheRead: 0, searches: 2, fetches: 0 });
    expect(r.searchRemarks).toEqual(["Web search was limited, so I relied on what I know."]);
    expect(r).toMatchObject({ ms: 1234, requestId: "req_1", stopReason: "end_turn", submitted: null, fallback: false });
  });

  it("notes a search that paused without a result, a fallback, and remarks inside the submitted answer", () => {
    const r = summarizeMessage(
      message("tool_use", [
        search("s1", "q"),
        { type: "fallback", from: { model: "claude-opus-5-5" } },
        {
          type: "tool_use",
          id: "t1",
          name: "submit_scores",
          input: { metrics: { moat: { rationale: "Search results were unavailable; scored on known facts." } } },
        },
      ]),
      { ms: 1 },
    );
    expect(r.steps[0]).toMatchObject({ result: "no result", ok: false });
    expect(r.fallback).toBe(true);
    expect(r.submitted).toBe("submit_scores");
    expect(r.searchRemarks).toEqual(["Search results were unavailable; scored on known facts."]);
  });
});

describe("searchRemarks", () => {
  it("only flags sentences about searching going badly", () => {
    expect(searchRemarks("I searched for the CEO. Results were great. Search tools were unavailable today!")).toEqual([
      "Search tools were unavailable today!",
    ]);
  });
});

describe("runIssues", () => {
  it("is empty for a clean scoring run", () => {
    const run = finishRun(start, {
      ms: 10,
      requests: [summarizeMessage(message("tool_use", [search("s1", "q"), results("s1", 5), { type: "tool_use", id: "t", name: "submit_scores", input: {} }]), { ms: 1 })],
    });
    expect(runIssues(run)).toEqual([]);
  });

  it("names search errors, missing searches, nudges and failures", () => {
    const run = finishRun(start, {
      ms: 10,
      requests: [
        summarizeMessage(message("end_turn", [search("a", "q"), searchError("a", "too_many_requests"), search("b", "q"), searchError("b", "too_many_requests")]), { ms: 1 }),
      ],
      failure: { error: new Error("Claude didn't submit scores.") },
    });
    expect(runIssues(run)).toEqual([
      "Failed: Error: Claude didn't submit scores.",
      "Web search error: too_many_requests (×2)",
      "Needed a nudge to answer",
    ]);

    const silent = finishRun(start, {
      ms: 1,
      requests: [summarizeMessage(message("tool_use", [{ type: "tool_use", id: "t", name: "submit_scores", input: {} }]), { ms: 1 })],
    });
    expect(runIssues(silent)).toEqual(["No web searches"]);
  });
});

describe("storage", () => {
  it("keeps the newest runs first, up to the cap, and survives junk", () => {
    let log: RunLog[] = [];
    for (let i = 0; i < MAX_RUNS + 5; i++) log = appendRun(log, finishRun({ ...start, id: `r${i}` }, { ms: 1, requests: [] }));
    expect(log).toHaveLength(MAX_RUNS);
    expect(log[0].id).toBe(`r${MAX_RUNS + 4}`);
    expect(parseRunLog(JSON.stringify(log))).toHaveLength(MAX_RUNS);
    expect(parseRunLog("not json")).toEqual([]);
    expect(parseRunLog(JSON.stringify([{ id: 1 }, log[0]]))).toHaveLength(1);
  });

  it("sends the server no Claude text and no code, only search queries", () => {
    const run = finishRun(start, {
      ms: 10,
      requests: [
        summarizeMessage(
          message("end_turn", [
            search("s1", "Apple CEO"),
            results("s1", 1),
            { type: "server_tool_use", id: "c1", name: "code_execution", input: { code: "secret()" } },
            { type: "text", text: "Private musings." },
          ]),
          { ms: 1 },
        ),
      ],
    });
    const json = JSON.stringify(serverEvent(run));
    expect(json).toContain("Apple CEO");
    expect(json).not.toContain("Private musings");
    expect(json).not.toContain("secret()");
  });
});

describe("recordingClient", () => {
  it("records every request of a real analysis loop, including one that fails", async () => {
    const responses: (Msg | Error)[] = [
      message("pause_turn", [search("s1", "q"), results("s1", 3)]),
      Object.assign(new Error("overloaded"), { status: 529 }),
    ];
    const inner: MessagesClient = {
      beta: {
        messages: {
          stream() {
            const next = responses.shift();
            return { finalMessage: async () => (next instanceof Error ? Promise.reject(next) : next!) };
          },
        },
      },
    };
    const entries: ReturnType<typeof summarizeMessage>[] = [];
    const client = recordingClient(inner, (e) => entries.push(e));
    await expect(analyzeWithClaude({ symbol: "AAPL", name: "Apple", sector: null, indexes: [] }, { client })).rejects.toThrow("overloaded");
    expect(entries.map((e) => e.stopReason ?? e.error)).toEqual(["pause_turn", "Error 529: overloaded"]);
  });
});
