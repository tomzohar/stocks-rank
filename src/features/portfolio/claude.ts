// Runs the two portfolio requests against the Claude API from the browser,
// with the viewer's own key, the same way the stock analysis does: Claude
// answers by calling a strict submit tool, which we validate and never
// execute. No web search: everything Claude needs is in the message.
import type Anthropic from "@anthropic-ai/sdk";
import { AnalysisError } from "@/features/analysis/analysis-error";
import { continuationContent, type MessagesClient } from "@/features/analysis/claude";
import { ANALYSIS_MODEL } from "@/features/analysis/prompt";
import type { Plan } from "./model";
import {
  buildPickMessage,
  buildProposalMessage,
  parsePicks,
  parseProposal,
  pickTool,
  PICK_SYSTEM_PROMPT,
  proposalTool,
  PROPOSAL_SYSTEM_PROMPT,
  type PickRequest,
  type PickResult,
  type ProposalRequest,
} from "./prompt";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;

/** The answer, plus at most one "please submit" nudge. */
const MAX_REQUESTS = 2;

/** One conversation that ends with Claude calling `tool`; returns the tool's input and the answering model. */
async function submitted(
  client: MessagesClient,
  { system, user, tool, what }: { system: string; user: string; tool: ReturnType<typeof pickTool | typeof proposalTool>; what: string },
): Promise<{ input: unknown; model: string }> {
  const messages: BetaMessageParam[] = [{ role: "user", content: user }];
  for (let request = 0; request < MAX_REQUESTS; request++) {
    const message = await client.beta.messages
      .stream({
        model: ANALYSIS_MODEL,
        max_tokens: 16_000,
        // Thinking is always on for this model; medium keeps the wizard quick.
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: [tool],
        messages,
      })
      .finalMessage();

    if (message.stop_reason === "refusal") throw new AnalysisError(`Claude declined to ${what}.`);
    const call = message.content.find((b): b is BetaToolUseBlock => b.type === "tool_use" && b.name === tool.name);
    if (call) return { input: call.input, model: message.model };
    if (message.stop_reason !== "end_turn") throw new AnalysisError(`Claude stopped early (${message.stop_reason}).`);
    messages.push(
      { role: "assistant", content: continuationContent(message.content) },
      { role: "user", content: `Call ${tool.name} now with your answer.` },
    );
  }
  throw new AnalysisError(`Claude didn't ${what}.`);
}

const today = (now: Date) => now.toISOString().slice(0, 10);

/** Claude picks stocks from the watchlist candidates. */
export async function pickWithClaude(req: PickRequest, { client, now = new Date() }: { client: MessagesClient; now?: Date }): Promise<PickResult> {
  const symbols = req.candidates.map((c) => c.symbol);
  const { input, model } = await submitted(client, {
    system: PICK_SYSTEM_PROMPT,
    user: buildPickMessage(req, today(now)),
    tool: pickTool(symbols),
    what: "pick stocks",
  });
  return parsePicks(input, symbols, model);
}

/** Claude proposes weights, a starting plan and monthly tips for the chosen stocks. */
export async function proposeWithClaude(req: ProposalRequest, { client, now = new Date() }: { client: MessagesClient; now?: Date }): Promise<Plan> {
  const { input, model } = await submitted(client, {
    system: PROPOSAL_SYSTEM_PROMPT,
    user: buildProposalMessage(req, today(now)),
    tool: proposalTool(req.candidates.map((c) => c.symbol)),
    what: "propose a portfolio",
  });
  return parseProposal(input, req, { model, createdAt: now.toISOString() });
}
