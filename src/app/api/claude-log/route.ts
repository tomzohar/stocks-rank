import { z } from "zod";

// The browser runs Claude with the viewer's own key, so the server never sees
// those calls. Each page posts a summary of its run here (no key, no Claude
// text) and it lands in the deployment's runtime log, one JSON line per run.

const text = (max: number) => z.string().max(max);
const step = z.object({ tool: text(60), input: text(400), result: text(400), ok: z.boolean() });
const request = z.object({
  ms: z.number().nonnegative(),
  model: text(100).nullable(),
  stopReason: text(60).nullable(),
  requestId: text(200).nullable(),
  fallback: z.boolean(),
  usage: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    searches: z.number().nonnegative(),
    fetches: z.number().nonnegative(),
  }),
  steps: z.array(step).max(60),
  submitted: text(100).nullable(),
  searchRemarks: z.array(text(400)).max(5),
  error: text(600).nullable(),
});
const event = z.object({
  id: text(64),
  kind: z.enum(["scoring", "picks", "proposal"]),
  subject: text(300),
  startedAt: text(40),
  ms: z.number().nonnegative(),
  outcome: z.enum(["ok", "error"]),
  error: text(600).nullable(),
  issues: z.array(text(700)).max(30),
  requests: z.array(request).max(10),
});

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = event.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const run = parsed.data;
  const line = JSON.stringify({ type: "claude-run", ...run });
  if (run.outcome === "error" || run.issues.length > 0) console.warn(line);
  else console.info(line);
  return new Response(null, { status: 204 });
}
