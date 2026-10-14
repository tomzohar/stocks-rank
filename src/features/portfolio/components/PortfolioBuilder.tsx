"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getApiKey, subscribe } from "@/features/analysis/browser-store";
import { ApiKeyForm } from "@/features/analysis/components/ApiKeyForm";
import { findStock } from "@/features/universe/universe";
import { refreshQuotes, useWatchlist, useWatchlistRows } from "@/features/watchlist/store";
import type { WatchlistEntry } from "@/features/watchlist/watchlist";
import { Button } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { Menu } from "@/ui/Menu";
import { ActionSheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { toCandidate, type Candidate } from "../candidates";
import { formatDollars } from "../model";
import {
  applyScoreSplit,
  ensureDraft,
  resetDraft,
  savePortfolio,
  startProposal,
  updateDraft,
  useDraft,
  useRun,
  type Draft,
  type Step,
} from "../store";
import { AmountField } from "./AmountField";
import { PlanEditor } from "./PlanEditor";
import { selectionFor, StepStocks } from "./StepStocks";
import page from "./Page.module.css";
import styles from "./PortfolioBuilder.module.css";

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "Stocks" },
  { step: 2, label: "Amounts" },
  { step: 3, label: "Proposal" },
];

const QUICK_MONTHLY = [250, 500, 1000, 2000];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((s) => b.includes(s));

/**
 * The portfolio builder: choose stocks from the watchlist (by hand, by rules
 * or with Claude), set the monthly and starting amounts, then edit Claude's
 * proposal and save it. The draft lives in this tab, so a reload keeps your place.
 */
export function PortfolioBuilder() {
  const entries = useWatchlist();
  const draft = useDraft();
  useEffect(() => ensureDraft(), []);
  // Both live in the browser: nothing to show until it has been read.
  if (entries === null || draft === null) return <Loading />;
  if (entries.length === 0) return <NoWatchlist />;
  return <Builder entries={entries} draft={draft} />;
}

function Builder({ entries, draft }: { entries: readonly WatchlistEntry[]; draft: Draft }) {
  const router = useRouter();
  const apiKey = useSyncExternalStore(subscribe, getApiKey, () => null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);

  const symbols = useMemo(() => entries.map((e) => e.symbol), [entries]);
  const rows = useWatchlistRows(symbols);
  const key = symbols.join(",");
  useEffect(() => {
    void refreshQuotes(key.split(","));
  }, [key]);
  const candidates = useMemo(
    () => symbols.map((s) => toCandidate(s, findStock(s), rows.get(s)?.summary ?? null, rows.get(s)?.loading ?? false)),
    [symbols, rows],
  );

  const demo = candidates.some((c) => c.demo) && candidates.every((c) => c.demo || !c.scores);
  const loading = candidates.filter((c) => c.loading).length;
  const selection = selectionFor(draft, candidates);
  const bySymbol = new Map(candidates.map((c) => [c.symbol, c]));
  const chosen = draft.chosen.map((s) => bySymbol.get(s)).filter((c): c is Candidate => c !== undefined);
  const canRun = demo || !!apiKey;

  const propose = () =>
    startProposal({ candidates: chosen, monthly: draft.monthly ?? 0, starting: draft.starting, note: draft.note }, { apiKey, demo });

  const next = () => {
    if (draft.step === 1) {
      const picked = selection.map((c) => c.symbol);
      updateDraft((d) => ({ step: 2, chosen: picked, plan: sameSet(d.chosen, picked) ? d.plan : null }));
    } else if (draft.step === 2 && draft.monthly) {
      if (draft.plan) {
        updateDraft((d) => ({ step: 3, plan: d.plan && { ...d.plan, monthly: d.monthly ?? d.plan.monthly, starting: d.starting } }));
      } else {
        updateDraft({ step: 3 });
        if (canRun) propose();
      }
    }
  };

  const save = () => {
    if (!draft.plan) return;
    savePortfolio(draft.plan);
    router.push("/portfolios");
    resetDraft();
  };

  return (
    <div className={page.view}>
      <div className={`${page.stack} reveal`}>
        <header className={page.nav}>
          <Link href="/watchlist" className={page.back}>
            <Icon name="chevronRight" size={18} />
            Watchlist
          </Link>
          <div className={page.titleRow}>
            <h1>New Portfolio</h1>
            <div className={page.toolbar}>
              <Menu
                label="Builder options"
                icon="more"
                variant="tinted"
                size="sm"
                sections={[{ items: [{ id: "reset", label: "Start Over", icon: "undo", destructive: true, onSelect: () => setConfirmReset(true) }] }]}
              />
            </div>
          </div>
          <ol className={styles.steps} aria-label="Steps">
            {STEPS.map(({ step, label }) => (
              <li key={step} className={cx(step < draft.step && styles.done, step === draft.step && styles.current)} aria-current={step === draft.step ? "step" : undefined}>
                <button type="button" disabled={step >= draft.step} onClick={() => updateDraft({ step })}>
                  <span className={styles.dot}>{step < draft.step ? <Icon name="check" size={13} /> : step}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </header>

        {draft.step === 1 && <StepStocks draft={draft} candidates={candidates} loading={loading} apiKey={apiKey} demo={demo} />}
        {draft.step === 2 && <StepAmounts draft={draft} chosen={chosen} canRun={canRun} />}
        {draft.step === 3 && (
          <StepProposal
            draft={draft}
            chosen={chosen}
            watchlist={symbols}
            apiKey={apiKey}
            demo={demo}
            onCreate={propose}
            onAskAgain={() => setConfirmAgain(true)}
          />
        )}

        <footer className={page.actionBar}>
          {draft.step === 1 ? (
            <Button variant="ghost" onClick={() => router.push("/watchlist")}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" icon="undo" onClick={() => updateDraft({ step: (draft.step - 1) as Step })}>
              Back
            </Button>
          )}
          <span className={page.actionHint}>
            {draft.step === 1
              ? `${selection.length} ${selection.length === 1 ? "stock" : "stocks"} chosen`
              : draft.step === 2
                ? draft.monthly
                  ? `${formatDollars(draft.monthly)} a month`
                  : "Enter a monthly amount"
                : draft.plan
                  ? `${draft.plan.holdings.length} holdings`
                  : ""}
          </span>
          {draft.step === 1 && (
            <Button variant="primary" disabled={selection.length === 0} onClick={next}>
              Next
            </Button>
          )}
          {draft.step === 2 && (
            <Button variant="primary" icon={canRun && !draft.plan ? "sparkle" : undefined} disabled={!draft.monthly} onClick={next}>
              {canRun && !draft.plan ? "Create Proposal" : "Next"}
            </Button>
          )}
          {draft.step === 3 && (
            <Button variant="primary" icon="check" disabled={!draft.plan || draft.plan.holdings.length === 0} onClick={save}>
              Save
            </Button>
          )}
        </footer>
      </div>

      <ActionSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Start over?"
        message="Your choices and any proposal in this draft will be thrown away."
        actions={[{ label: "Start Over", destructive: true, onSelect: resetDraft }]}
      />
      <ActionSheet
        open={confirmAgain}
        onClose={() => setConfirmAgain(false)}
        title={demo ? "Rebuild the proposal?" : "Ask Claude for a new proposal?"}
        message={`It replaces this one, along with your edits.${demo ? "" : " Each proposal is billed to your API key."}`}
        actions={[
          {
            label: "Replace Proposal",
            destructive: true,
            onSelect: () => {
              updateDraft({ plan: null });
              propose();
            },
          },
        ]}
      />
    </div>
  );
}

function StepAmounts({ draft, chosen, canRun }: { draft: Draft; chosen: readonly Candidate[]; canRun: boolean }) {
  const year = (draft.monthly ?? 0) * 12 + draft.starting;
  return (
    <>
      <section className={page.card} aria-labelledby="amounts-title" style={{ "--i": 1 } as React.CSSProperties}>
        <header className={page.cardHead}>
          <h2 id="amounts-title">How much will you invest?</h2>
        </header>
        <AmountField
          label="Each month"
          value={draft.monthly}
          onChange={(n) => updateDraft({ monthly: n && n > 0 ? n : null })}
          help="Your regular dollar-cost-averaging amount, split across the stocks."
          placeholder="500"
        />
        <div className={styles.chips} role="group" aria-label="Common monthly amounts">
          {QUICK_MONTHLY.map((n) => (
            <button key={n} type="button" aria-pressed={draft.monthly === n} onClick={() => updateDraft({ monthly: n })}>
              {formatDollars(n)}
            </button>
          ))}
        </div>
        <AmountField
          label="Starting amount"
          value={draft.starting}
          onChange={(n) => updateDraft({ starting: n ?? 0 })}
          help="Money to put in at the start. 0 is fine."
        />
        {draft.monthly ? (
          <p className={page.lede}>
            That&rsquo;s <strong>{formatDollars(year)}</strong> invested over the first year.
          </p>
        ) : null}
      </section>

      {canRun && (
        <section className={page.card} aria-labelledby="note-title" style={{ "--i": 2 } as React.CSSProperties}>
          <header className={page.cardHead}>
            <h2 id="note-title">Anything Claude should know?</h2>
          </header>
          <textarea
            className={styles.textarea}
            rows={2}
            maxLength={1000}
            value={draft.note}
            aria-labelledby="note-title"
            placeholder="Optional: your time horizon, how much risk you're comfortable with, what you already own"
            onChange={(e) => updateDraft({ note: e.target.value })}
          />
        </section>
      )}

      <section className={page.card} aria-labelledby="chosen-title" style={{ "--i": 3 } as React.CSSProperties}>
        <header className={page.cardHead}>
          <h2 id="chosen-title">Your {chosen.length} stocks</h2>
          <Button variant="ghost" size="sm" onClick={() => updateDraft({ step: 1 })}>
            Change
          </Button>
        </header>
        <ul className={styles.symbols}>
          {chosen.map((c) => (
            <li key={c.symbol} title={c.name}>
              {c.symbol}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function StepProposal({
  draft,
  chosen,
  watchlist,
  apiKey,
  demo,
  onCreate,
  onAskAgain,
}: {
  draft: Draft;
  chosen: readonly Candidate[];
  watchlist: readonly string[];
  apiKey: string | null;
  demo: boolean;
  onCreate: () => void;
  onAskAgain: () => void;
}) {
  const run = useRun("proposal", draft.id);
  const monthly = draft.monthly ?? 0;

  if (draft.plan) {
    return (
      <>
        <Callout tone="accent" icon="pencil">
          Everything below is editable: the name, amounts, weights, roles, notes and tips. Save when it looks right.
        </Callout>
        <PlanEditor plan={draft.plan} onChange={(plan) => updateDraft({ plan })} addable={watchlist} />
        {(apiKey || demo) && !run.running && (
          <div className={styles.again}>
            <Button variant="ghost" size="sm" icon="sparkle" onClick={onAskAgain}>
              {demo ? "Rebuild from Scores" : "Ask Claude Again"}
            </Button>
          </div>
        )}
        <p className={page.footnote}>
          A starting point for your own decisions, not investment advice. Prices and scores are delayed and can be wrong.
        </p>
      </>
    );
  }

  if (run.running) {
    return (
      <section className={page.card} aria-busy="true" aria-label="Building your proposal">
        <Callout busy tone="accent" title="Claude is building your proposal…">
          Weighing your {chosen.length} stocks against {formatDollars(monthly)} a month
          {draft.starting > 0 ? ` and ${formatDollars(draft.starting)} to start` : ""}. This usually takes a minute or two.
        </Callout>
        <Skeleton style={{ height: "2rem", width: "60%" }} />
        <Skeleton style={{ height: "0.7rem" }} />
        <Skeleton style={{ height: "9rem" }} />
      </section>
    );
  }

  const needsKey = !demo && (!apiKey || run.error?.keyRejected);
  return (
    <section className={page.card} aria-labelledby="proposal-title">
      <header className={page.cardHead}>
        <h2 id="proposal-title">Your proposal</h2>
      </header>
      {run.error && (
        <Callout tone="critical" role="alert">
          {run.error.message}
        </Callout>
      )}
      {needsKey ? (
        <>
          <p className={page.lede}>
            Claude weighs your {chosen.length} stocks, plans the {formatDollars(monthly)} a month, and writes tips for each month.
            It runs in this browser with your own Claude API key.
          </p>
          <ApiKeyForm />
        </>
      ) : (
        <div className={styles.createRow}>
          <Button variant="primary" icon="sparkle" onClick={onCreate}>
            {run.error ? "Try Again" : "Create Proposal with Claude"}
          </Button>
          <span className={page.actionHint}>{demo ? "Demo data: weighted by score, not Claude." : "Billed to your API key."}</span>
        </div>
      )}
      <div className={styles.createRow}>
        <Button
          variant="secondary"
          onClick={() => applyScoreSplit({ candidates: [...chosen], monthly, starting: draft.starting })}
        >
          Split by Score Instead
        </Button>
        <span className={page.actionHint}>No Claude: weights follow each stock&rsquo;s score.</span>
      </div>
    </section>
  );
}

function NoWatchlist() {
  return (
    <div className={page.view}>
      <div className={`${page.empty} reveal`}>
        <span className={page.emptyIcon}>
          <Icon name="star" size={34} />
        </span>
        <h1>Start with a watchlist</h1>
        <p>A portfolio is built from the stocks on your watchlist. Add a few first.</p>
        <Link href="/watchlist" className={styles.linkButton}>
          Go to Watchlist
        </Link>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className={page.view} aria-busy="true" aria-label="Loading the portfolio builder">
      <Skeleton style={{ width: "12rem", height: "2.2rem", marginBottom: "1.25rem" }} />
      <Skeleton style={{ height: "16rem", borderRadius: "14px" }} />
    </div>
  );
}
