// Runs the qualitative analysis against the Claude API: Claude researches the
// company with web search, then answers by calling the strict submit_scores
// tool, which we validate and never execute. Runs in the browser with the
// viewer's own API key, so the key never reaches the stocks-rank server.
import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_MODEL,
  SUBMIT_TOOL,
  SUBMIT_TOOL_NAME,
  SYSTEM_PROMPT,
  buildUserMessage,
  parseSubmission,
} from "./prompt";
import type { AnalysisSubject, QualitativeAnalysis } from "./types";
import { AnalysisError } from "./analysis-error";

export { AnalysisError };

type BetaMessage = Anthropic.Beta.BetaMessage;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

/** The slice of the SDK client this module uses — lets tests pass a fake. */
export interface MessagesClient {
  beta: { messages: { stream(params: StreamParams): { finalMessage(): Promise<BetaMessage> } } };
}

/** Server-tool pauses and the one "please submit" nudge, together. */
const MAX_REQUESTS = 4;

/**
 * A client that calls api.anthropic.com straight from the browser with the
 * viewer's key. The SDK makes this opt-in because a key in a web page is only
 * as safe as the page; that's acceptable here because it is the viewer's own
 * key, kept in their browser, and the site's CSP only lets the page talk to
 * itself and api.anthropic.com.
 */
export function createBrowserClient(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 180_000, maxRetries: 1 });
}

function searchResultsIn(content: readonly BetaContentBlock[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) out.push({ title: r.title, url: r.url });
    }
  }
  return out;
}

/**
 * Content to echo back when continuing a turn. After a mid-output fallback,
 * blocks before the last fallback marker belong to the declined model and
 * must not be sent back.
 */
export function continuationContent(content: readonly BetaContentBlock[]): BetaContentBlock[] {
  const lastFallback = content.findLastIndex((b) => b.type === "fallback");
  return content.slice(lastFallback + 1);
}

export async function analyzeWithClaude(
  subject: AnalysisSubject,
  { client, now = new Date() }: { client: MessagesClient; now?: Date },
): Promise<QualitativeAnalysis> {
  const messages: BetaMessageParam[] = [
    { role: "user", content: buildUserMessage(subject, now.toISOString().slice(0, 10)) },
  ];
  const searchResults: { title: string; url: string }[] = [];

  for (let request = 0; request < MAX_REQUESTS; request++) {
    const message = await client.beta.messages
      .stream({
        model: ANALYSIS_MODEL,
        max_tokens: 32_000,
        // Thinking is always on for this model; effort sets its depth.
        output_config: { effort: "high" },
        // If a safety classifier declines, retry on Anthropic's recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }, SUBMIT_TOOL],
        messages,
      })
      .finalMessage();

    searchResults.push(...searchResultsIn(message.content));

    if (message.stop_reason === "refusal") {
      const category = message.stop_details?.category;
      throw new AnalysisError(`Claude declined to analyze ${subject.symbol}${category ? ` (${category})` : ""}.`);
    }

    const submission = message.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === SUBMIT_TOOL_NAME,
    );
    if (submission) {
      return parseSubmission(submission.input, searchResults, {
        model: message.model,
        analyzedAt: now.toISOString(),
      });
    }

    if (message.stop_reason === "pause_turn") {
      // Long server-tool turn: send it back as-is and the API resumes it.
      messages.push({ role: "assistant", content: continuationContent(message.content) });
    } else if (message.stop_reason === "end_turn") {
      messages.push(
        { role: "assistant", content: continuationContent(message.content) },
        { role: "user", content: `Call ${SUBMIT_TOOL_NAME} now with your scores.` },
      );
    } else {
      throw new AnalysisError(`Analysis stopped early (${message.stop_reason}).`);
    }
  }
  throw new AnalysisError("Claude didn't submit scores.");
}
