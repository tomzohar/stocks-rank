"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { modelLabel } from "@/features/analysis/display";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { LocalTime } from "@/ui/LocalTime";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { ActionSheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { Toast } from "@/ui/Toast";
import { RUN_KIND_LABEL, runIssues, runTotals, type RequestLog, type RunLog } from "../log";
import { clearRunLog, useRunLog } from "../store";
import styles from "./ClaudeLogView.module.css";

type Filter = "all" | "problems";

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const count = (n: number) => n.toLocaleString("en-US");

/** Every Claude run this browser made, newest first, with what went wrong. */
export function ClaudeLogView() {
  const log = useRunLog();
  const subject = useSearchParams().get("subject")?.toUpperCase() ?? null;
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  if (log === null) {
    return (
      <div className={styles.view} aria-busy="true" aria-label="Loading the Claude log">
        <Skeleton style={{ width: "10rem", height: "2.2rem", marginBottom: "1.25rem" }} />
        <Skeleton style={{ height: "8rem", borderRadius: "14px" }} />
      </div>
    );
  }

  const forSubject = subject ? log.filter((r) => r.subject.toUpperCase() === subject) : log;
  const shown = filter === "problems" ? forSubject.filter((r) => runIssues(r).length > 0) : forSubject;
  const problems = forSubject.filter((r) => runIssues(r).length > 0).length;

  async function copy(runs: RunLog[]) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(runs, null, 2));
      setCopied(Date.now());
    } catch {
      // Clipboard blocked; nothing useful to show.
    }
  }

  return (
    <div className={styles.view}>
      <div className={`${styles.stack} reveal`}>
        <header className={styles.nav}>
          <div className={styles.titleRow}>
            <h1>Claude Log</h1>
            {log.length > 0 && (
              <div className={styles.toolbar}>
                <Button variant="tinted" size="sm" icon="download" onClick={() => void copy(shown)}>
                  Copy
                </Button>
                <Button variant="tinted" size="sm" icon="trash" iconOnly aria-label="Clear the log" onClick={() => setConfirmClear(true)} />
              </div>
            )}
          </div>
          <p className={styles.subtitle}>
            {subject ? `${subject} · ` : ""}
            {forSubject.length} {forSubject.length === 1 ? "run" : "runs"}
            {problems > 0 ? ` · ${problems} with problems` : ""}
            {subject && (
              <>
                {" · "}
                <Link href="/claude-log">Show all</Link>
              </>
            )}
          </p>
        </header>

        {forSubject.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Icon name="sparkle" size={30} />
            </span>
            <h2>No Claude runs yet</h2>
            <p>Each time Claude scores a stock, picks stocks or proposes a portfolio with your key, the run shows up here.</p>
          </div>
        ) : (
          <>
            <SegmentedControl
              label="Show"
              segments={[
                { id: "all", label: "All Runs" },
                { id: "problems", label: `Problems${problems ? ` (${problems})` : ""}` },
              ]}
              value={filter}
              onChange={setFilter}
            />
            {shown.length === 0 ? (
              <p className={styles.none}>
                <Icon name="check" size={15} /> No problems in these runs.
              </p>
            ) : (
              <ul className={styles.list}>
                {shown.map((run) => (
                  <li key={run.id}>
                    <Run run={run} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className={styles.footnote}>
          Kept on this device, newest 50 runs. Each run&rsquo;s summary, without Claude&rsquo;s text, also goes to the
          server log. Your API key is never logged.
        </p>
      </div>

      <ActionSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the Claude log?"
        message="Runs are removed from this device. Scores and portfolios stay."
        actions={[{ label: "Clear Log", destructive: true, onSelect: clearRunLog }]}
      />
      {copied && (
        <Toast key={copied} icon="check" onDismiss={() => setCopied(null)}>
          Copied {shown.length === 1 ? "the run" : `${shown.length} runs`} as JSON
        </Toast>
      )}
    </div>
  );
}

function Run({ run }: { run: RunLog }) {
  const issues = runIssues(run);
  const totals = runTotals(run);
  const tone = run.outcome === "error" ? "bad" : issues.length ? "warn" : "good";
  return (
    <details className={styles.run}>
      <summary>
        <span className={cx(styles.dot, styles[tone])} aria-hidden="true" />
        <span className={styles.head}>
          <span className={styles.title}>
            <strong>{run.subject}</strong>
            <span>{RUN_KIND_LABEL[run.kind]}</span>
          </span>
          <span className={styles.meta}>
            <LocalTime iso={run.startedAt} options={{ dateStyle: "medium", timeStyle: "short" }} /> · {seconds(run.ms)}
            {run.kind === "scoring" ? ` · ${totals.searches} ${totals.searches === 1 ? "search" : "searches"}` : ""} ·{" "}
            {run.outcome === "ok" ? "OK" : "Failed"}
          </span>
          {issues.length > 0 && (
            <span className={styles.issues}>
              {issues.map((i) => (
                <span key={i} className={cx(styles.issue, run.outcome === "error" && styles.issueBad)}>
                  {i}
                </span>
              ))}
            </span>
          )}
        </span>
        <Icon name="chevronRight" size={15} className={styles.chevron} />
      </summary>
      <div className={styles.body}>
        <p className={styles.totals}>
          {count(totals.input)} tokens in{totals.cacheRead ? ` (${count(totals.cacheRead)} from cache)` : ""} ·{" "}
          {count(totals.output)} out · {run.requests.length} {run.requests.length === 1 ? "request" : "requests"}
        </p>
        {run.requests.map((r, i) => (
          <Request key={i} r={r} n={i + 1} />
        ))}
        {run.error && <p className={styles.error}>{run.error}</p>}
      </div>
    </details>
  );
}

function Request({ r, n }: { r: RequestLog; n: number }) {
  // Remarks from Claude's text are already in the text below; these come from its answer.
  const remarks = r.searchRemarks.filter((s) => !r.text.includes(s.replace(/…$/, "")));
  return (
    <section className={styles.request}>
      <h3>
        Request {n}
        <span>
          {r.model ? modelLabel(r.model) : "no answer"}
          {r.stopReason ? ` · ${r.stopReason}` : ""} · {seconds(r.ms)}
          {r.fallback ? " · fallback" : ""}
        </span>
      </h3>
      {r.error && <p className={styles.error}>{r.error}</p>}
      {r.steps.length > 0 && (
        <ol className={styles.steps}>
          {r.steps.map((s, i) => (
            <li key={i} className={cx(!s.ok && styles.stepBad)}>
              <Icon name={s.tool === "web_search" ? "search" : s.ok ? "check" : "alert"} size={13} />
              <span className={styles.stepTool}>{s.tool.replace(/_/g, " ")}</span>
              <span className={styles.stepInput}>{s.input}</span>
              <span className={styles.stepResult}>{s.result}</span>
            </li>
          ))}
        </ol>
      )}
      {remarks.length > 0 && (
        <ul className={styles.remarks} aria-label="From Claude's answer">
          {remarks.map((s) => (
            <li key={s}>&ldquo;{s}&rdquo;</li>
          ))}
        </ul>
      )}
      {r.text && <p className={styles.text}>{r.text}</p>}
      <p className={styles.small}>
        {r.submitted ? `Answered with ${r.submitted}` : r.error ? "" : "No answer submitted"}
        {r.requestId ? ` · ${r.requestId}` : ""}
      </p>
    </section>
  );
}
