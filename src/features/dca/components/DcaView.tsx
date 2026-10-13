"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { PriceHistory } from "@/features/market-data/history";
import { formatPercent } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { cx } from "@/ui/cx";
import { Icon, type IconName } from "@/ui/Icon";
import { Panel } from "@/ui/Panel";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { adviseLatest, parsePriceInput, RULE_ORDER, type Advice, type LevelId } from "../advice";
import { bucketKey, dayKey, toMonthly, type Interval } from "../candles";
import {
  actionCopy,
  checkCopy,
  formatDay,
  KEY_POINT_LABEL,
  keyPointCopy,
  LEVEL_TEXT,
  priceFormatter,
  RULE_TEXT,
  type Fmt,
} from "../copy";
import { keyPoints, type KeyPoint, type KeyPointKind } from "../keypoints";
import { DAY_MS, RULES } from "../rules";
import { computeSignals, indexAtOrAfter } from "../series";
import { saveAvgCost, useAvgCost } from "../store";
import { PriceChart, type ChartLevel, type ChartMarker, type ChartStyle, type ChartTone } from "./PriceChart";
import styles from "./DcaView.module.css";

type RangeId = "6m" | "1y" | "3y" | "5y";
const RANGE_DAYS: Record<RangeId, number> = { "6m": 182, "1y": 365, "3y": 3 * 365, "5y": 5 * 365 };
const RANGES = [
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "3y", label: "3Y" },
  { id: "5y", label: "5Y" },
] as const;
const STYLES = [
  { id: "candles", label: "Candles" },
  { id: "line", label: "Line" },
] as const;
const INTERVALS = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
] as const;

const LEVEL_STYLE: Record<LevelId, { tone: ChartTone; dashed: boolean; line: boolean }> = {
  trimLarge: { tone: "critical", dashed: true, line: true },
  trimSmall: { tone: "critical", dashed: true, line: true },
  high: { tone: "muted", dashed: true, line: true },
  hot: { tone: "warning", dashed: true, line: true },
  avg: { tone: "primary", dashed: false, line: true },
  // The dashed guide series already draws this one; keep just its axis label.
  dip: { tone: "good", dashed: true, line: false },
};

const MARKER_STYLE: Record<KeyPointKind, Pick<ChartMarker, "tone" | "position" | "shape">> = {
  high: { tone: "muted", position: "aboveBar", shape: "circle" },
  dip: { tone: "good", position: "belowBar", shape: "arrowUp" },
  hot: { tone: "warning", position: "aboveBar", shape: "circle" },
  trimSmall: { tone: "critical", position: "aboveBar", shape: "arrowDown" },
  trimLarge: { tone: "critical", position: "aboveBar", shape: "arrowDown" },
};

const GLYPH: Record<ChartMarker["shape"], IconName | null> = { arrowUp: "arrowUp", arrowDown: "arrowDown", circle: null };

const pointId = (p: KeyPoint) => `${p.kind}-${p.t}`;
/** One marker per kind per candle: a month can hold several daily key points. */
const markerId = (p: KeyPoint, interval: Interval) => `${p.kind}-${bucketKey(interval, p.t)}`;
const formatMonth = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The DCA tab: today's call under the four rules and why, the price chart
 * with the levels and moments that matter, and the same in text.
 */
export function DcaView({ symbol, history }: { symbol: string; history: PriceHistory }) {
  const { candles, currency } = history;
  const fmt = useMemo(() => priceFormatter(currency), [currency]);
  const signals = useMemo(() => computeSignals(candles), [candles]);
  const saved = useAvgCost(symbol);
  const avgCost = saved ?? null;
  const advice = useMemo(() => adviseLatest(candles, signals, avgCost), [candles, signals, avgCost]);

  const [style, setStyle] = useState<ChartStyle>("candles");
  const [interval, setBarInterval] = useState<Interval>("daily");
  const [range, setRange] = useState<RangeId>("1y");
  const [focus, setFocus] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const last = candles.at(-1)!;
  const from = indexAtOrAfter(candles, last.t - RANGE_DAYS[range] * DAY_MS);
  const points = useMemo(() => keyPoints(candles, signals, from, avgCost), [candles, signals, from, avgCost]);

  const display = useMemo(
    () => (interval === "monthly" ? toMonthly(candles) : candles.map((c) => ({ ...c, key: dayKey(c.t) }))),
    [candles, interval],
  );
  // The last daily bar behind each candle, for the readout and the guide line.
  const dailyIndex = useMemo(() => {
    const m = new Map<string, number>();
    candles.forEach((c, i) => m.set(bucketKey(interval, c.t), i));
    return m;
  }, [candles, interval]);
  const guide = useMemo(
    () => [...dailyIndex].map(([key, i]) => ({ key, value: signals.high[i].price * (1 - RULES.dip.drawdown) })),
    [dailyIndex, signals],
  );
  const visible = useMemo(
    () => ({ from: bucketKey(interval, candles[from].t), to: bucketKey(interval, last.t) }),
    [interval, candles, from, last],
  );
  const markers = useMemo<ChartMarker[]>(() => {
    const byId = new Map<string, ChartMarker>();
    for (const p of points) {
      const id = markerId(p, interval);
      if (!byId.has(id)) byId.set(id, { key: bucketKey(interval, p.t), id, text: KEY_POINT_LABEL[p.kind], ...MARKER_STYLE[p.kind] });
    }
    return [...byId.values()];
  }, [points, interval]);
  const focusedPoint = points.find((p) => pointId(p) === focus);
  const focusMarker = focusedPoint ? markerId(focusedPoint, interval) : null;
  const levels = useMemo<ChartLevel[]>(
    () => (advice?.levels ?? []).map((l) => ({ id: l.id, price: l.price, title: LEVEL_TEXT[l.id].label, ...LEVEL_STYLE[l.id] })),
    [advice],
  );

  if (!advice) return null;

  const hoverIndex = (hoverKey === null ? undefined : dailyIndex.get(hoverKey)) ?? candles.length - 1;
  const hoverCandle = display.find((c) => c.key === (hoverKey ?? display.at(-1)!.key)) ?? display.at(-1)!;
  const readout = {
    when: interval === "monthly" ? formatMonth(hoverCandle.t) : formatDay(hoverCandle.t),
    drawdown: signals.drawdown[hoverIndex],
    month: signals.monthChange[hoverIndex],
  };
  const action = actionCopy(advice, symbol, fmt);

  return (
    <div className={styles.view}>
      <Panel className={styles.call} aria-labelledby="dca-call">
        <div className={styles.callMain}>
          <p className={styles.eyebrow}>Today&rsquo;s call · close of {formatDay(advice.t)}</p>
          <h2 id="dca-call" className={cx(styles.action, styles[action.tone])}>
            <span className={styles.actionIcon} aria-hidden="true">
              <Icon name={ACTION_ICON[advice.action]} size={20} />
            </span>
            {action.title}
          </h2>
          <p className={styles.detail}>{action.detail}</p>
          {action.nextBuy && <p className={styles.chip}>{action.nextBuy}</p>}
          <AvgCostField symbol={symbol} saved={saved} currency={currency} />
        </div>
        <div className={styles.why}>
          <h3 className={styles.subhead}>Why: the four rules</h3>
          <ol className={styles.rules}>
            {RULE_ORDER.map((id, n) => {
              const check = advice.checks.find((c) => c.id === id)!;
              const copy = checkCopy(check, advice, fmt);
              return (
                <li key={id} className={cx(styles.rule, styles[copy.tone], check.triggered && styles.fired)}>
                  <span className={styles.ruleNum} aria-hidden="true">
                    {n + 1}
                  </span>
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleText}>
                      {RULE_TEXT[id].when} <span aria-hidden="true">→</span>
                      <span className="visually-hidden">:</span> <strong>{RULE_TEXT[id].then}</strong>
                    </p>
                    <p className={styles.reading}>{copy.reading}</p>
                  </div>
                  <span className={styles.status}>
                    {check.triggered && <Icon name="check" size={13} />}
                    {copy.status}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>

      <Panel className={styles.chartPanel} aria-label={`${symbol} price chart`}>
        <div className={styles.toolbar}>
          <SegmentedControl label="Chart type" segments={STYLES} value={style} onChange={setStyle} className={styles.seg} />
          <SegmentedControl label="Candle interval" segments={INTERVALS} value={interval} onChange={setBarInterval} className={styles.seg} />
          <SegmentedControl label="Range" segments={RANGES} value={range} onChange={setRange} className={styles.segRange} />
        </div>
        <p className={styles.readout} aria-live="off">
          <span className={styles.readWhen}>{readout.when}</span>
          {style === "candles" ? (
            <>
              <Ohlc k="O" v={fmt(hoverCandle.open)} />
              <Ohlc k="H" v={fmt(hoverCandle.high)} />
              <Ohlc k="L" v={fmt(hoverCandle.low)} />
              <Ohlc k="C" v={fmt(hoverCandle.close)} />
            </>
          ) : (
            <Ohlc k="Close" v={fmt(hoverCandle.close)} />
          )}
          <Ohlc k="vs 52W high" v={formatPercent(-readout.drawdown, { signed: true })} />
          <Ohlc k="1M" v={formatPercent(readout.month, { signed: true })} />
        </p>
        <PriceChart
          candles={display}
          guide={guide}
          style={style}
          levels={levels}
          markers={markers}
          visible={visible}
          focus={focusMarker}
          onHover={setHoverKey}
          label={`${symbol} ${interval} ${style === "candles" ? "candlestick" : "line"} chart. Key points and price levels are listed below.`}
        />
        <ul className={styles.legend} aria-label="Legend">
          <li>
            <i className={cx(styles.key, styles.keyGuide)} /> Double-down line, 20% under the 52-week high
          </li>
          <li>
            <i className={cx(styles.key, styles.keyTrim)} /> Trim levels
          </li>
          <li>
            <i className={cx(styles.key, styles.keyHot)} /> Buy 0.5× above
          </li>
          {avgCost !== null && (
            <li>
              <i className={cx(styles.key, styles.keyAvg)} /> Your average
            </li>
          )}
          <li>
            <Icon name="arrowUp" size={13} className={styles.good} /> 2× buy zone entered
          </li>
          <li>
            <i className={cx(styles.dot, styles.warning)} /> Up 20% in a month
          </li>
        </ul>
      </Panel>

      <div className={styles.columns}>
        <Panel eyebrow={`In the last ${RANGES.find((r) => r.id === range)!.label}`} title="Key points">
          {points.length ? (
            <ol className={styles.points}>
              {points.toReversed().map((p) => {
                const id = pointId(p);
                const copy = keyPointCopy(p, fmt);
                const m = MARKER_STYLE[p.kind];
                const glyph = GLYPH[m.shape];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={styles.point}
                      aria-pressed={focus === id}
                      onClick={() => setFocus(focus === id ? null : id)}
                    >
                      <span className={cx(styles.glyph, styles[m.tone])} aria-hidden="true">
                        {glyph ? <Icon name={glyph} size={14} /> : <i className={styles.dot} />}
                      </span>
                      <span className={styles.pointText}>
                        <strong>{copy.title}</strong>
                        <span>{copy.detail}</span>
                      </span>
                      <Icon name="chart" size={15} className={styles.pointGo} />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.empty}>No rule fired in this range. Try a longer one.</p>
          )}
        </Panel>
        <Panel eyebrow="Potential entries and trims" title="Price levels">
          <LevelList advice={advice} fmt={fmt} />
        </Panel>
      </div>

      {history.source === "demo" && (
        <Callout tone="warning" title="Demo prices">
          This price history is generated offline for development. It is not real.
        </Callout>
      )}
      <p className={styles.footnote}>
        The rules run on daily closes: the 52-week high is the highest close of the past year, and a month is 30 days.
        Both buy multipliers can apply at once, and they multiply. A trim call stands while the gain is past its level, so skip it if you&rsquo;ve already trimmed there. This is
        a rules check, not investment advice.
      </p>
    </div>
  );
}

const ACTION_ICON: Record<Advice["action"], IconName> = {
  trimLarge: "arrowDown",
  trimSmall: "arrowDown",
  double: "arrowUp",
  half: "minus",
  offset: "check",
  regular: "check",
};

function Ohlc({ k, v }: { k: string; v: string }) {
  return (
    <span className={styles.ohlc}>
      <span className={styles.ohlcKey}>{k}</span> {v}
    </span>
  );
}

function LevelList({ advice, fmt }: { advice: Advice; fmt: Fmt }) {
  const rows: ({ id: LevelId; price: number } | { id: "now"; price: number })[] = [...advice.levels];
  const at = rows.findIndex((r) => r.price < advice.price);
  rows.splice(at === -1 ? rows.length : at, 0, { id: "now", price: advice.price });
  return (
    <>
      <ul className={styles.levels}>
        {rows.map((r) =>
          r.id === "now" ? (
            <li key="now" className={cx(styles.level, styles.now)}>
              <span className={cx(styles.swatch, styles.swatchNow)} aria-hidden="true" />
              <span className={styles.levelText}>
                <strong>Now</strong>
                <span>Last close</span>
              </span>
              <span className={styles.levelPrice}>{fmt(r.price)}</span>
              <span className={styles.levelDist} />
            </li>
          ) : (
            <li key={r.id} className={styles.level}>
              <span className={cx(styles.swatch, styles[`swatch_${r.id}`])} aria-hidden="true" />
              <span className={styles.levelText}>
                <strong>{LEVEL_TEXT[r.id].label}</strong>
                <span>{r.id === "high" ? `Closing high, ${formatDay(advice.high.t)}` : LEVEL_TEXT[r.id].note}</span>
              </span>
              <span className={styles.levelPrice}>{fmt(r.price)}</span>
              <span className={styles.levelDist}>{formatPercent(r.price / advice.price - 1, { signed: true })}</span>
            </li>
          ),
        )}
      </ul>
      {advice.avgCost === null && <p className={styles.empty}>Add your average buy price above to see where the trims sit.</p>}
    </>
  );
}

function currencySymbol(currency: string | null): string {
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "$";
  } catch {
    return "$";
  }
}

/** Your average buy price, saved on this device. Only the trim rules read it. */
function AvgCostField({ symbol, saved, currency }: { symbol: string; saved: number | null | undefined; currency: string | null }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const value = draft ?? (saved ? String(saved) : "");
  const ready = saved !== undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      saveAvgCost(symbol, null);
      setDraft(null);
      return;
    }
    const price = parsePriceInput(value);
    if (price === null) {
      setInvalid(true);
      return;
    }
    saveAvgCost(symbol, price);
    setDraft(null);
    setInvalid(false);
  }

  return (
    <form className={styles.cost} onSubmit={onSubmit} noValidate>
      <label htmlFor={`avg-${symbol}`} className={styles.costLabel}>
        Your average buy price
      </label>
      <div className={styles.costRow}>
        <div className={cx(styles.field, invalid && styles.fieldInvalid)}>
          <span aria-hidden="true">{currencySymbol(currency)}</span>
          <input
            id={`avg-${symbol}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 142.50"
            value={value}
            disabled={!ready}
            aria-invalid={invalid || undefined}
            aria-describedby={`avg-${symbol}-hint`}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
          />
        </div>
        <Button type="submit" variant="tinted" disabled={!ready || draft === null}>
          Save
        </Button>
        {saved != null && draft === null && (
          <Button variant="ghost" onClick={() => saveAvgCost(symbol, null)}>
            Clear
          </Button>
        )}
      </div>
      <p id={`avg-${symbol}-hint`} className={cx(styles.costHint, invalid && styles.costError)} role={invalid ? "alert" : undefined}>
        {invalid
          ? "Enter a price, like 142.50."
          : saved
            ? "Saved on this device only. The trim rules use it."
            : "The trim rules (1 and 2) need it. It stays on this device."}
      </p>
    </form>
  );
}
