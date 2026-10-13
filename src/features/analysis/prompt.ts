// The prompt, the submit_scores tool, and validation of what comes back.
// Pure — the API call lives in claude.ts.
import { z } from "zod";
import { QUALITATIVE_METRIC_IDS, type QualitativeMetricId } from "@/features/scoring/metrics";
import type { AnalysisSubject, QualitativeAnalysis } from "./types";

export const ANALYSIS_MODEL = "claude-opus-5-5";

/** Bump when the prompt or rubric changes, so cached analyses are redone. */
export const ANALYSIS_VERSION = "1";

export const SUBMIT_TOOL_NAME = "submit_scores";

export const SYSTEM_PROMPT = `You are an equity analyst scoring a US-listed public company on six qualitative factors for a stock-ranking app. Each factor gets exactly 0, 5 or 10.

- moat: durability of the competitive advantage (network effects, switching costs, scale, IP, brand). 10 = wide and durable; 5 = real but contestable; 0 = little or none.
- ceo: the current chief executive's track record, capital allocation, credibility and alignment with shareholders. 10 = proven and exceptional; 5 = competent or not yet proven; 0 = poor record, turmoil or credibility problems.
- recessionProof: how revenue and profits held up in past downturns, or would, given demand cyclicality and balance-sheet strength. 10 = resilient; 5 = moderately cyclical; 0 = highly cyclical or fragile.
- secularTrend: whether the business rides a multi-year structural trend. 10 = squarely in a strong tailwind; 5 = neutral or mixed; 0 = facing structural decline.
- culture: clarity of mission and health of the culture — employee sentiment, governance, ethics record. 10 = strong and distinctive; 5 = unremarkable; 0 = toxic or scandal-ridden.
- talent: ability to attract and keep strong people, especially key technical and leadership talent. 10 = a destination employer; 5 = average; 0 = struggles to hire or retain, or a leadership exodus.

Judge relative to other large-cap companies. Use web search to check anything that may have changed since your training data: who the CEO is now, recent leadership changes, layoffs, scandals, major strategic shifts. A few targeted searches are usually enough. Where evidence is thin, score 5 and say so.

Each rationale is one or two plain sentences naming the concrete evidence. The summary is two or three sentences on the overall qualitative picture. List as sources only pages from your search results that you actually relied on.

Investors read these scores as one input among many, so be candid rather than promotional. When you're done, call ${SUBMIT_TOOL_NAME} once with your scores.`;

export function buildUserMessage(subject: AnalysisSubject, today: string): string {
  const facts = [
    `Company: ${subject.name}`,
    `Ticker: ${subject.symbol}`,
    subject.sector ? `Sector: ${subject.sector}` : null,
    `Index membership: ${subject.indexes.join(", ")}`,
    `Today's date: ${today}`,
  ].filter(Boolean);
  return `${facts.join("\n")}\n\nScore this company on the six factors.`;
}

const assessmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  // Rationale first, so the score follows from the evidence.
  properties: {
    rationale: { type: "string" },
    score: { type: "integer", enum: [0, 5, 10] },
  },
  required: ["rationale", "score"],
} as const;

/** Strict client tool Claude calls with its final answer. Never executed — we read its input. */
export const SUBMIT_TOOL = {
  name: SUBMIT_TOOL_NAME,
  description: "Submit the final 0/5/10 scores, with rationales, for all six qualitative factors.",
  strict: true,
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      ...Object.fromEntries(QUALITATIVE_METRIC_IDS.map((id) => [id, assessmentJsonSchema])),
      summary: { type: "string" },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { title: { type: "string" }, url: { type: "string" } },
          required: ["title", "url"],
        },
      },
    },
    required: [...QUALITATIVE_METRIC_IDS, "summary", "sources"],
  },
};

const assessmentSchema = z.object({
  rationale: z.string().trim().min(1),
  score: z.union([z.literal(0), z.literal(5), z.literal(10)]),
});

const submissionSchema = z.object({
  ...(Object.fromEntries(QUALITATIVE_METRIC_IDS.map((id) => [id, assessmentSchema])) as Record<
    QualitativeMetricId,
    typeof assessmentSchema
  >),
  summary: z.string().trim(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

const MAX_SOURCES = 8;

function normalizeUrl(url: string): string {
  return url.trim().replace(/#.*$/, "").replace(/\/+$/, "");
}

/**
 * Validates submit_scores input. Sources are kept only if a web search
 * actually returned them, so a made-up URL can't reach the page.
 */
export function parseSubmission(
  input: unknown,
  searchResults: readonly { title: string; url: string }[],
  meta: { model: string; analyzedAt: string },
): QualitativeAnalysis {
  const parsed = submissionSchema.parse(input);
  const returned = new Map(searchResults.map((r) => [normalizeUrl(r.url), r]));
  const seen = new Set<string>();
  const sources: { title: string; url: string }[] = [];
  for (const s of parsed.sources) {
    const key = normalizeUrl(s.url);
    const hit = returned.get(key);
    if (!hit || seen.has(key)) continue;
    seen.add(key);
    sources.push({ title: s.title.trim() || hit.title, url: hit.url });
    if (sources.length === MAX_SOURCES) break;
  }
  return {
    metrics: Object.fromEntries(QUALITATIVE_METRIC_IDS.map((id) => [id, parsed[id]])) as QualitativeAnalysis["metrics"],
    summary: parsed.summary,
    sources,
    model: meta.model,
    analyzedAt: meta.analyzedAt,
    source: "claude",
  };
}
