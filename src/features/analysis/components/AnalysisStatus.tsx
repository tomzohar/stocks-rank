"use client";

import Link from "next/link";
import type { AnalysisState } from "@/features/analysis/types";
import { Button } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { ApiKeyForm } from "./ApiKeyForm";

/** Says plainly what's happening with Claude's metrics until its scores are in. */
export function AnalysisStatus({ analysis, symbol, onRetry }: { analysis: AnalysisState; symbol: string; onRetry: () => void }) {
  switch (analysis.status) {
    case "ready":
    case "checking":
      return null;
    case "needs-key":
      return (
        <Callout
          tone="accent"
          icon="sparkle"
          role="region"
          aria-label="Set up Claude scoring"
          title="Let Claude score the judgement calls"
        >
          <p>
            Moat, CEO, recession resilience, secular trend, culture and talent need research, not a formula. Add your
            Claude API key and Claude reads up on the company on the web and scores them, with its reasons.
          </p>
          <ApiKeyForm />
        </Callout>
      );
    case "pending":
      return (
        <Callout tone="accent" busy role="status" title="Claude is researching this company">
          It&apos;s reading recent coverage on the web to score metrics 8–13, which takes about a minute. The radar
          fills in when it&apos;s done.
        </Callout>
      );
    case "error":
      return (
        <Callout
          tone="critical"
          icon="x"
          role="alert"
          title="Claude couldn't score metrics 8–13"
          actions={
            !analysis.keyRejected && (
              <Button icon="refresh" onClick={onRetry}>
                Try again
              </Button>
            )
          }
        >
          <p>
            {analysis.message} <Link href={`/claude-log?subject=${encodeURIComponent(symbol)}`}>See the run log</Link>
          </p>
          {analysis.keyRejected && <ApiKeyForm submitLabel="Use this key instead" />}
        </Callout>
      );
  }
}
