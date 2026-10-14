"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMultiplier } from "@/features/dca/rules";
import { findStock } from "@/features/universe/universe";
import { formatPrice } from "@/lib/format";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { LocalTime } from "@/ui/LocalTime";
import { Menu } from "@/ui/Menu";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";
import {
  allocate,
  balanceWeights,
  formatDollars,
  isBalanced,
  MAX_HOLDINGS,
  ROLE_TEXT,
  ROLES,
  weightTotal,
  type Holding,
  type Plan,
  type Role,
} from "../model";
import { monthlyBuys } from "../monthly";
import { useReadings } from "../store";
import { AllocationBar, ShadeDot } from "./AllocationBar";
import { AmountField } from "./AmountField";
import styles from "./PlanEditor.module.css";

const SOURCE_TEXT: Record<Plan["source"], string> = {
  claude: "Proposed by Claude",
  score: "Weighted by score, without Claude",
  demo: "Demo data, not a proposal from Claude",
};

/**
 * Everything in a plan, editable in place: the name, both amounts, each
 * holding's weight, role and note, the starting plan, the monthly tips and
 * the summary. Dollar figures follow the weights as they change, and "This
 * month" applies the DCA buy rules to today's prices.
 */
export function PlanEditor({
  plan,
  onChange,
  addable,
}: {
  plan: Plan;
  onChange: (plan: Plan) => void;
  /** Stocks that can be added as holdings (the watchlist, less what's in the plan). */
  addable: readonly string[];
}) {
  const set = (patch: Partial<Plan>) => onChange({ ...plan, ...patch });
  const setHolding = (i: number, patch: Partial<Holding>) =>
    set({ holdings: plan.holdings.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const total = weightTotal(plan.holdings);
  const split = allocate(plan);
  const canAdd = addable.filter((s) => !plan.holdings.some((h) => h.symbol === s));

  return (
    <div className={styles.editor}>
      <section className={styles.card} aria-label="Overview">
        <input
          className={styles.name}
          value={plan.name}
          maxLength={80}
          aria-label="Portfolio name"
          placeholder="Portfolio name"
          onChange={(e) => set({ name: e.target.value })}
        />
        <p className={styles.source}>
          <Icon name={plan.source === "claude" ? "sparkle" : "info"} size={13} />
          {SOURCE_TEXT[plan.source]}
          {plan.model && ` (${plan.model})`} · <LocalTime iso={plan.createdAt} options={{ dateStyle: "medium" }} />
        </p>
        <div className={styles.amounts}>
          <AmountField
            label="Each month"
            value={plan.monthly}
            onChange={(n) => n !== null && set({ monthly: n })}
          />
          <AmountField label="Starting amount" value={plan.starting} onChange={(n) => n !== null && set({ starting: n })} />
        </div>
        <AllocationBar holdings={plan.holdings} />
        <TextBlock label="Summary" value={plan.summary} onChange={(summary) => set({ summary })} placeholder="What this portfolio is for" />
      </section>

      <section className={styles.card} aria-labelledby="holdings-title">
        <header className={styles.cardHead}>
          <h2 id="holdings-title">Holdings</h2>
          <div className={styles.headActions}>
            {canAdd.length > 0 && plan.holdings.length < MAX_HOLDINGS && (
              <Menu
                label="Add a stock"
                icon="plus"
                variant="tinted"
                size="sm"
                sections={[
                  {
                    title: "From your watchlist",
                    items: canAdd.slice(0, 30).map((symbol) => ({
                      id: symbol,
                      label: `${symbol} · ${findStock(symbol)?.name ?? ""}`,
                      onSelect: () =>
                        set({ holdings: [...plan.holdings, { symbol, weight: 0, role: "Satellite", note: "" }] }),
                    })),
                  },
                ]}
              />
            )}
          </div>
        </header>
        <div className={cx(styles.weightBar, !isBalanced(plan.holdings) && styles.off)} role="status">
          <span>
            Weights add up to <strong>{Number(total.toFixed(1))}%</strong>
            {!isBalanced(plan.holdings) && plan.holdings.length > 0 && " · dollar amounts are scaled to 100%"}
          </span>
          {!isBalanced(plan.holdings) && plan.holdings.length > 0 && (
            <Button size="sm" variant="tinted" onClick={() => set({ holdings: balanceWeights(plan.holdings) })}>
              Balance to 100%
            </Button>
          )}
        </div>
        {plan.holdings.length === 0 ? (
          <p className={styles.empty}>No holdings. Add a stock from your watchlist.</p>
        ) : (
          <ul className={styles.holdings}>
            {plan.holdings.map((h, i) => (
              <li key={h.symbol} className={cx(styles.holding, split[i].share === 0 && styles.out)}>
                <div className={styles.holdingHead}>
                  <ShadeDot index={i} />
                  <span className={styles.ident}>
                    <Link href={`/stock/${h.symbol}`} className={styles.symbol}>
                      {h.symbol}
                    </Link>
                    <span className={styles.company}>{findStock(h.symbol)?.name ?? ""}</span>
                  </span>
                  <label className={styles.weight}>
                    <span className="visually-hidden">{h.symbol} weight, percent</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step={1}
                      value={Number.isFinite(h.weight) ? h.weight : ""}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        setHolding(i, { weight: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 });
                      }}
                    />
                    <span aria-hidden="true">%</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="x"
                    iconOnly
                    aria-label={`Remove ${h.symbol}`}
                    onClick={() => set({ holdings: plan.holdings.filter((_, j) => j !== i) })}
                  />
                </div>
                <div className={styles.holdingMeta}>
                  <label className={styles.role}>
                    <span className="visually-hidden">{h.symbol} role</span>
                    <select value={h.role} onChange={(e) => setHolding(i, { role: e.target.value as Role })} title={ROLE_TEXT[h.role]}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className={styles.money}>
                    {split[i].share === 0 ? (
                      "Left out"
                    ) : (
                      <>
                        <strong>{formatDollars(split[i].monthly)}</strong>/mo
                        {plan.starting > 0 && <> · {formatDollars(split[i].starting)} to start</>}
                      </>
                    )}
                  </span>
                </div>
                <textarea
                  className={styles.note}
                  value={h.note}
                  rows={1}
                  maxLength={2000}
                  aria-label={`Why ${h.symbol}`}
                  placeholder="Why it's here"
                  onChange={(e) => setHolding(i, { note: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ThisMonth plan={plan} />

      {(plan.starting > 0 || plan.startingPlan) && (
        <section className={styles.card} aria-labelledby="starting-title">
          <header className={styles.cardHead}>
            <h2 id="starting-title">Investing the {formatDollars(plan.starting)} start</h2>
          </header>
          <TextBlock
            label="Starting plan"
            hideLabel
            value={plan.startingPlan}
            onChange={(startingPlan) => set({ startingPlan })}
            placeholder="All at once, or spread over a few months?"
          />
        </section>
      )}

      <section className={styles.card} aria-labelledby="tips-title">
        <header className={styles.cardHead}>
          <h2 id="tips-title">Splitting {formatDollars(plan.monthly)} each month</h2>
          {plan.tips.length < 12 && (
            <Button variant="tinted" size="sm" icon="plus" onClick={() => set({ tips: [...plan.tips, ""] })}>
              Tip
            </Button>
          )}
        </header>
        {plan.tips.length === 0 ? (
          <p className={styles.empty}>No tips yet.</p>
        ) : (
          <ol className={styles.tips}>
            {plan.tips.map((tip, i) => (
              <li key={i}>
                <textarea
                  className={styles.note}
                  value={tip}
                  rows={1}
                  maxLength={2000}
                  aria-label={`Tip ${i + 1}`}
                  placeholder="A tip for each month"
                  autoFocus={tip === "" && i === plan.tips.length - 1}
                  onChange={(e) => set({ tips: plan.tips.map((t, j) => (j === i ? e.target.value : t)) })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="x"
                  iconOnly
                  aria-label={`Remove tip ${i + 1}`}
                  onClick={() => set({ tips: plan.tips.filter((_, j) => j !== i) })}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** This month's buys under the DCA rules, from each holding's latest close. */
function ThisMonth({ plan }: { plan: Plan }) {
  const [fit, setFit] = useState(true);
  const readings = useReadings(plan.holdings.map((h) => h.symbol));
  const known = new Map(plan.holdings.map((h) => [h.symbol, readings.get(h.symbol) ?? null]));
  const { buys, total } = monthlyBuys(plan.holdings, plan.monthly, known, { fit });
  const changed = buys.some((b) => b.multiplier !== 1);

  return (
    <section className={styles.card} aria-labelledby="month-title">
      <header className={styles.cardHead}>
        <h2 id="month-title">This month</h2>
      </header>
      <p className={styles.lede}>
        Your {formatDollars(plan.monthly)}, resized by the DCA rules: <strong>2×</strong> for a stock 20% or more under its
        52-week high, <strong>0.5×</strong> after a 20% month.
      </p>
      <ul className={styles.buys}>
        {buys.map((b, i) => {
          const r = readings.get(b.symbol);
          return (
            <li key={b.symbol} className={cx(b.amount === 0 && styles.out)}>
              <ShadeDot index={i} />
              <span className={styles.buySymbol}>{b.symbol}</span>
              <span className={styles.buyWhy}>
                {r === undefined ? (
                  <Skeleton style={{ width: "6rem", height: "0.9rem" }} />
                ) : r === null ? (
                  "No price reading"
                ) : (
                  <>
                    {formatPrice(r.price, "USD")} · {Math.round(r.drawdown * 100)}% under high
                    {r.monthChange !== null && ` · ${r.monthChange >= 0 ? "+" : ""}${Math.round(r.monthChange * 100)}% in a month`}
                  </>
                )}
              </span>
              <span className={cx(styles.chip, b.multiplier > 1 && styles.up, b.multiplier < 1 && styles.down)}>
                {formatMultiplier(b.multiplier)}
              </span>
              <span className={styles.buyAmount}>{formatDollars(b.amount)}</span>
            </li>
          );
        })}
        <li className={styles.buyTotal}>
          <span>Total</span>
          <span className={styles.buyAmount}>{formatDollars(total)}</span>
        </li>
      </ul>
      <Switch
        checked={fit}
        onChange={setFit}
        label={`Keep the month at ${formatDollars(plan.monthly)}`}
        detail={
          fit
            ? changed
              ? "Bigger buys are paid for by scaling the others down."
              : "No rule fires this month, so it's the regular split."
            : `Buys follow the rules exactly${changed ? `, ${total > plan.monthly ? "over" : "under"} budget by ${formatDollars(Math.abs(total - plan.monthly))}` : ""}.`
        }
      />
    </section>
  );
}

/** A labelled text area that grows with its content. */
function TextBlock({
  label,
  hideLabel,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.block}>
      <span className={hideLabel ? "visually-hidden" : styles.blockLabel}>{label}</span>
      <textarea className={styles.note} value={value} rows={2} maxLength={4000} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
