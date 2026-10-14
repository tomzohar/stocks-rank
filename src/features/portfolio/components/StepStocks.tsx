"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApiKeyForm } from "@/features/analysis/components/ApiKeyForm";
import { RadarGlyph } from "@/features/radar/RadarGlyph";
import { METRICS } from "@/features/scoring/metrics";
import { Button } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Skeleton } from "@/ui/Skeleton";
import { Stepper } from "@/ui/Stepper";
import { Switch } from "@/ui/Switch";
import { byScore, selectByRules, type Candidate, type MinGrade, type SelectionRules } from "../candidates";
import { MAX_HOLDINGS } from "../model";
import { PICK_GOALS } from "../prompt";
import { startPick, updateDraft, useRun, type Draft, type Method } from "../store";
import page from "./Page.module.css";
import styles from "./StepStocks.module.css";

const METHODS: { id: Method; label: string; text: string }[] = [
  { id: "manual", label: "By Hand", text: "Tick the stocks you want from your watchlist." },
  { id: "rules", label: "By Rules", text: "Set a few rules and the best scores that pass are picked, with a cap per sector." },
  { id: "claude", label: "Claude Picks", text: "Claude reads your watchlist's scorecards and picks a diversified set for your goal." },
];

/** Step 1: choose the stocks, by hand, by rules or with Claude. */
export function StepStocks({
  draft,
  candidates,
  loading,
  apiKey,
  demo,
}: {
  draft: Draft;
  candidates: readonly Candidate[];
  /** Watchlist stocks whose market data is still loading. */
  loading: number;
  apiKey: string | null;
  demo: boolean;
}) {
  const method = METHODS.find((m) => m.id === draft.method)!;
  return (
    <>
      <section className={page.card} aria-label="How to choose" style={{ "--i": 1 } as React.CSSProperties}>
        <SegmentedControl
          label="How to choose"
          segments={METHODS}
          value={draft.method}
          onChange={(m) =>
            updateDraft((d) => ({
              method: m,
              // Switching to By Hand starts from what the other method chose.
              manual: m === "manual" && d.manual.length === 0 ? selectionFor(d, candidates).map((c) => c.symbol) : d.manual,
            }))
          }
        />
        <p className={page.lede}>{method.text}</p>
        {loading > 0 && (
          <Callout busy tone="neutral">
            Loading market data for {loading} {loading === 1 ? "stock" : "stocks"}…
          </Callout>
        )}
      </section>
      {draft.method === "manual" && <Manual draft={draft} candidates={candidates} />}
      {draft.method === "rules" && <Rules draft={draft} candidates={candidates} />}
      {draft.method === "claude" && <ClaudePicks draft={draft} candidates={candidates} loading={loading} apiKey={apiKey} demo={demo} />}
    </>
  );
}

/** The stocks a draft's current method chooses, in the order they should be shown. */
export function selectionFor(draft: Draft, candidates: readonly Candidate[]): Candidate[] {
  const by = new Map(candidates.map((c) => [c.symbol, c]));
  switch (draft.method) {
    case "manual":
      return candidates.filter((c) => draft.manual.includes(c.symbol)).sort(byScore);
    case "rules":
      return selectByRules(candidates, draft.rules).picked;
    case "claude":
      return (draft.picks?.picks ?? []).map((p) => by.get(p.symbol)).filter((c) => c !== undefined);
  }
}

function Manual({ draft, candidates }: { draft: Draft; candidates: readonly Candidate[] }) {
  const sorted = [...candidates].sort(byScore);
  const chosen = new Set(draft.manual);
  const toggle = (symbol: string) =>
    updateDraft((d) => ({
      manual: d.manual.includes(symbol) ? d.manual.filter((s) => s !== symbol) : [...d.manual, symbol].slice(0, MAX_HOLDINGS),
    }));
  return (
    <section className={page.card} aria-labelledby="manual-title" style={{ "--i": 2 } as React.CSSProperties}>
      <header className={page.cardHead}>
        <h2 id="manual-title">Your watchlist</h2>
        <div className={styles.headActions}>
          <Button variant="ghost" size="sm" onClick={() => updateDraft({ manual: sorted.slice(0, MAX_HOLDINGS).map((c) => c.symbol) })}>
            All
          </Button>
          <Button variant="ghost" size="sm" disabled={!chosen.size} onClick={() => updateDraft({ manual: [] })}>
            None
          </Button>
        </div>
      </header>
      <ul className={styles.list}>
        {sorted.map((c) => {
          const on = chosen.has(c.symbol);
          return (
            <li key={c.symbol}>
              <button
                type="button"
                className={styles.row}
                aria-pressed={on}
                disabled={!on && chosen.size >= MAX_HOLDINGS}
                onClick={() => toggle(c.symbol)}
              >
                <StockInfo c={c} />
                <span className={cx(styles.check, on && styles.on)} aria-hidden="true">
                  {on && <Icon name="check" size={14} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={page.footnote}>
        {chosen.size} of {candidates.length} chosen{chosen.size >= MAX_HOLDINGS ? ` (the most a portfolio holds)` : ""}.
      </p>
    </section>
  );
}

const GRADES: { id: MinGrade; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "Mixed", label: "Mixed+" },
  { id: "Strong", label: "Strong" },
];

function Rules({ draft, candidates }: { draft: Draft; candidates: readonly Candidate[] }) {
  const rules = draft.rules;
  const set = (patch: Partial<SelectionRules>) => updateDraft((d) => ({ rules: { ...d.rules, ...patch } }));
  const { picked, excluded } = selectByRules(candidates, rules);
  const label = (id: string) => METRICS.find((m) => m.id === id)?.label ?? id;
  return (
    <>
      <section className={page.card} aria-labelledby="rules-title" style={{ "--i": 2 } as React.CSSProperties}>
        <header className={page.cardHead}>
          <h2 id="rules-title">Rules</h2>
        </header>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Minimum grade</span>
          <SegmentedControl label="Minimum grade" segments={GRADES} value={rules.minGrade} onChange={(minGrade) => set({ minGrade })} />
        </div>
        <div className={styles.controls}>
          <Switch checked={rules.cashOverDebt} onChange={(cashOverDebt) => set({ cashOverDebt })} label="More cash than debt" detail={`${label("cashVsDebt")} scores 5 or 10`} />
          <Switch checked={rules.growing} onChange={(growing) => set({ growing })} label="Revenue growing 10%+" detail={`${label("revenueGrowth")} scores 5 or 10`} />
          <Switch
            checked={rules.beatsMarket}
            onChange={(beatsMarket) => set({ beatsMarket })}
            label="Beat the S&P 500"
            detail="10+ points ahead over 5 years"
          />
          <Switch checked={rules.claudeOnly} onChange={(claudeOnly) => set({ claudeOnly })} label="Scored by Claude" detail="Only stocks with all 13 metrics" />
          <Stepper label="At most" detail="Best scores first" value={rules.limit} min={1} max={MAX_HOLDINGS} onChange={(limit) => set({ limit })} format={(n) => `${n} stocks`} />
          <Stepper
            label="Per sector"
            detail="Keeps the mix diversified"
            value={rules.maxPerSector ?? 0}
            min={0}
            max={10}
            onChange={(n) => set({ maxPerSector: n === 0 ? null : n })}
            format={(n) => (n === 0 ? "Any" : String(n))}
          />
        </div>
      </section>
      <Chosen title="Matches" picked={picked} detail={(c) => c.sector ?? ""} empty="No stock on your watchlist passes these rules. Loosen one." />
      {excluded.length > 0 && (
        <details className={cx(page.card, styles.excluded)} style={{ "--i": 4 } as React.CSSProperties}>
          <summary>
            Left out <span>{excluded.length}</span>
          </summary>
          <ul className={styles.reasons}>
            {excluded.map((e) => (
              <li key={e.symbol}>
                <b>{e.symbol}</b> {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function ClaudePicks({
  draft,
  candidates,
  loading,
  apiKey,
  demo,
}: {
  draft: Draft;
  candidates: readonly Candidate[];
  loading: number;
  apiKey: string | null;
  demo: boolean;
}) {
  const run = useRun("pick", draft.id);
  const max = Math.min(MAX_HOLDINGS, candidates.length);
  const reasons = new Map(draft.picks?.picks.map((p) => [p.symbol, p.reason]));
  const picked = selectionFor(draft, candidates);
  const ask = () =>
    startPick({ candidates: [...candidates].sort(byScore), goal: draft.goal, count: draft.count, note: draft.pickNote }, { apiKey, demo });
  const needsKey = !demo && (!apiKey || run.error?.keyRejected);

  return (
    <>
      <section className={page.card} aria-labelledby="claude-title" style={{ "--i": 2 } as React.CSSProperties}>
        <header className={page.cardHead}>
          <h2 id="claude-title">Ask Claude</h2>
        </header>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Goal</span>
          <SegmentedControl label="Goal" segments={PICK_GOALS} value={draft.goal} onChange={(goal) => updateDraft({ goal })} />
        </div>
        <div className={styles.controls}>
          <Stepper
            label="How many"
            value={Math.min(draft.count ?? 0, max)}
            min={0}
            max={max}
            onChange={(n) => updateDraft({ count: n === 0 ? null : n })}
            format={(n) => (n === 0 ? "Claude decides" : `${n} stocks`)}
          />
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Anything Claude should know (optional)</span>
          <textarea
            className={styles.textarea}
            rows={2}
            maxLength={1000}
            value={draft.pickNote}
            placeholder="e.g. I already own an S&P 500 fund; no more than two banks"
            onChange={(e) => updateDraft({ pickNote: e.target.value })}
          />
        </label>
        {needsKey ? (
          <>
            {run.error && <Callout tone="critical" role="alert">{run.error.message}</Callout>}
            <ApiKeyForm />
          </>
        ) : run.running ? (
          <Callout busy tone="accent" title="Claude is choosing…">
            Reading the scorecards of your {candidates.length} stocks. This takes about a minute.
          </Callout>
        ) : (
          <>
            {run.error && (
              <Callout tone="critical" role="alert">
                {run.error.message} <Link href="/claude-log">See the run log</Link>
              </Callout>
            )}
            <div className={styles.askRow}>
              <Button variant="primary" icon="sparkle" disabled={loading > 0} onClick={ask}>
                {draft.picks ? "Ask Again" : "Ask Claude to Pick"}
              </Button>
              <span className={styles.hint}>
                {loading > 0 ? "Waiting for market data…" : demo ? "Demo data: picks by score, not Claude." : "Billed to your API key."}
              </span>
            </div>
          </>
        )}
      </section>
      {draft.picks && (
        <>
          {draft.picks.summary && (
            <Callout tone="accent" icon="sparkle" title={draft.picks.source === "demo" ? "Demo picks" : "Claude's picks"}>
              {draft.picks.summary}
            </Callout>
          )}
          <Chosen title="Picks" picked={picked} detail={(c) => reasons.get(c.symbol) ?? ""} empty="No picks." />
        </>
      )}
    </>
  );
}

/** A read-only list of what a method chose, with a reason or detail per stock. */
function Chosen({
  title,
  picked,
  detail,
  empty,
}: {
  title: string;
  picked: readonly Candidate[];
  detail: (c: Candidate) => ReactNode;
  empty: string;
}) {
  return (
    <section className={page.card} aria-label={title} style={{ "--i": 3 } as React.CSSProperties}>
      <header className={page.cardHead}>
        <h2>
          {title} <span className={styles.count}>{picked.length}</span>
        </h2>
        {picked.length > 0 && (
          <Button variant="ghost" size="sm" icon="pencil" onClick={() => updateDraft({ method: "manual", manual: picked.map((c) => c.symbol) })}>
            Adjust by Hand
          </Button>
        )}
      </header>
      {picked.length === 0 ? (
        <p className={page.lede}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {picked.map((c) => (
            <li key={c.symbol} className={styles.row}>
              <StockInfo c={c} detail={detail(c)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StockInfo({ c, detail }: { c: Candidate; detail?: ReactNode }) {
  const shape = METRICS.map((m) => c.scores?.[m.id] ?? 0);
  return (
    <>
      <span className={styles.glyph}>
        <RadarGlyph scores={shape} size={34} />
      </span>
      <span className={styles.ident}>
        <span className={styles.symbol}>{c.symbol}</span>
        <span className={styles.name}>{detail || c.name}</span>
      </span>
      {c.ratio === null ? (
        c.loading ? (
          <Skeleton style={{ width: "4.5rem", height: "1.3rem", borderRadius: "999px" }} />
        ) : (
          <span className={styles.grade}>No data</span>
        )
      ) : (
        <span className={cx(styles.grade, c.grade && styles[c.grade.tone])}>
          {c.grade?.label} <b>{Math.round(c.ratio * 100)}%</b>
        </span>
      )}
    </>
  );
}
