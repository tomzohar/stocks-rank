"use client";

import Link from "next/link";
import { forgetApiKey, keyHint } from "@/features/analysis/browser-store";
import { hostname, isWebUrl, modelLabel, shortDate } from "@/features/analysis/display";
import type { AnalysisState } from "@/features/analysis/types";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import styles from "./ClaudeTake.module.css";

/** Claude's summary, who scored it and when, its sources, and the cache and key controls. */
export function ClaudeTake({
  analysis,
  symbol,
  apiKey,
  onRefresh,
}: {
  analysis: AnalysisState;
  symbol: string;
  apiKey: string | null;
  onRefresh: () => void;
}) {
  const keyControls = apiKey && (
    <p className={styles.key}>
      <Icon name="key" size={13} /> Using your key <code>{keyHint(apiKey)}</code>
      <Button variant="link" size="sm" onClick={forgetApiKey}>
        Forget key
      </Button>
    </p>
  );
  if (analysis.status !== "ready") return keyControls ? <div className={styles.take}>{keyControls}</div> : null;

  const a = analysis.analysis;
  const sources = a.sources.filter((src) => isWebUrl(src.url));
  return (
    <div className={styles.take}>
      <blockquote className={styles.summary}>
        <Icon name="sparkle" size={16} className={styles.quoteIcon} />
        <p>{a.summary}</p>
      </blockquote>
      <p className={styles.meta}>
        {a.source === "demo"
          ? "Demo analysis · generated offline, not real"
          : `Scored by ${modelLabel(a.model)} · ${new Date(a.analyzedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`}
        {a.source === "claude" && (
          <>
            {" · "}
            <Link href={`/claude-log?subject=${encodeURIComponent(symbol)}`}>Run log</Link>
          </>
        )}
      </p>

      {analysis.cache && (
        <div className={styles.cache}>
          <span>
            <Icon name="database" size={13} /> Saved in this browser · refreshes after{" "}
            <time dateTime={new Date(analysis.cache.expiresAt).toISOString()}>{shortDate(analysis.cache.expiresAt)}</time>
          </span>
          <Button
            size="sm"
            icon="refresh"
            onClick={onRefresh}
            title={apiKey ? "Discards the saved scores and runs a new analysis with your key" : "Discards the saved scores"}
          >
            Refresh now
          </Button>
        </div>
      )}

      {sources.length > 0 && (
        <details className={styles.sources}>
          <summary>
            {sources.length} source{sources.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.title}
                  <Icon name="external" size={12} />
                </a>
                <span>{hostname(src.url)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {keyControls}
    </div>
  );
}
