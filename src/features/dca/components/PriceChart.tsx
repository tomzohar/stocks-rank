"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import styles from "./PriceChart.module.css";

/** A candle keyed by its business day ("2025-03-14", or the 1st for a month). */
export interface ChartCandle {
  key: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ChartTone = "good" | "warning" | "critical" | "primary" | "muted";

export interface ChartLevel {
  id: string;
  price: number;
  title: string;
  tone: ChartTone;
  dashed: boolean;
  /** Draw the line across the chart, or only its label on the price axis. */
  line: boolean;
}

export interface ChartMarker {
  key: string;
  id: string;
  text: string;
  tone: ChartTone;
  position: "aboveBar" | "belowBar";
  shape: "circle" | "arrowUp" | "arrowDown";
}

export type ChartStyle = "candles" | "line";

interface Theme {
  surface: string;
  text: string;
  grid: string;
  border: string;
  series: string;
  seriesFill: string;
  seriesClear: string;
  font: string;
  tone: Record<ChartTone, string>;
}

/** The canvas needs concrete colours: let it resolve our tokens to rgba(). */
function readTheme(el: HTMLElement): Theme {
  const css = getComputedStyle(el);
  const ctx = document.createElement("canvas").getContext("2d");
  const color = (name: string) => {
    const value = css.getPropertyValue(name).trim();
    if (!ctx || !value) return value || "#888";
    ctx.fillStyle = "#888";
    ctx.fillStyle = value;
    return String(ctx.fillStyle);
  };
  const series = color("--series");
  return {
    surface: color("--surface"),
    text: color("--text-secondary"),
    grid: color("--border"),
    border: color("--border-strong"),
    series,
    seriesFill: color("--series-fill"),
    seriesClear: series.startsWith("#") ? `${series}00` : "rgba(0, 0, 0, 0)",
    font: css.fontFamily,
    tone: {
      good: color("--good"),
      warning: color("--warning"),
      critical: color("--critical"),
      primary: color("--text-primary"),
      muted: color("--text-muted"),
    },
  };
}

function useColorScheme(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const bump = () => setTick((t) => t + 1);
    mq.addEventListener("change", bump);
    return () => mq.removeEventListener("change", bump);
  }, []);
  return tick;
}

/** The crosshair's time as our business-day key. */
function keyOf(time: Time | undefined): string | null {
  if (time === undefined) return null;
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`;
}

/**
 * TradingView Lightweight Charts, as candles or a line, with the DCA levels as
 * price lines, the double-down line as a dashed guide, and markers on the
 * moments that matter. Pinch, drag and scroll to explore; the price levels and
 * markers are listed in text beside the chart too.
 */
export function PriceChart({
  candles,
  guide,
  style,
  levels,
  markers,
  visible,
  focus,
  onHover,
  label,
}: {
  candles: readonly ChartCandle[];
  /** The double-down line: 20% under the trailing 52-week high. */
  guide: readonly { key: string; value: number }[];
  style: ChartStyle;
  levels: readonly ChartLevel[];
  markers: readonly ChartMarker[];
  /** Range to show; applied when it changes, not on every redraw. */
  visible: { from: string; to: string };
  /** A marker id to bring into view and enlarge. */
  focus: string | null;
  onHover: (key: string | null) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const main = useRef<ISeriesApi<SeriesType> | null>(null);
  const guideSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const markerApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);
  const fitLevels = useRef<number[]>([]);
  const applied = useRef<string | null>(null);
  const hover = useRef(onHover);
  const scheme = useColorScheme();

  useEffect(() => {
    hover.current = onHover;
  }, [onHover]);

  // The chart itself lives as long as the component.
  useEffect(() => {
    const el = box.current!;
    const api = createChart(el, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: { vertTouchDrag: false },
      rightPriceScale: { scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { rightOffset: 4, fixLeftEdge: true, lockVisibleTimeRangeOnResize: true },
      localization: { locale: "en-US" },
    });
    const onMove = (p: MouseEventParams<Time>) => hover.current(p.point ? keyOf(p.time) : null);
    api.subscribeCrosshairMove(onMove);
    chart.current = api;
    return () => {
      api.unsubscribeCrosshairMove(onMove);
      api.remove();
      chart.current = null;
      main.current = null;
      guideSeries.current = null;
      markerApi.current = null;
      priceLines.current = [];
      applied.current = null;
    };
  }, []);

  // Series, colours and data. A style or interval switch rebuilds the series.
  useEffect(() => {
    const api = chart.current;
    if (!api || !box.current) return;
    const theme = readTheme(box.current);
    api.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.surface },
        textColor: theme.text,
        fontFamily: theme.font,
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border },
    });

    const keep = api.timeScale().getVisibleLogicalRange();
    if (main.current) api.removeSeries(main.current);
    if (guideSeries.current) api.removeSeries(guideSeries.current);
    markerApi.current = null;
    priceLines.current = [];

    const autoscaleInfoProvider = (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
      const res = original();
      if (!res?.priceRange) return res;
      let { minValue, maxValue } = res.priceRange;
      // Pull nearby levels into view; far-off ones keep their axis label only.
      for (const p of fitLevels.current) {
        if (p <= res.priceRange.maxValue * 1.3 && p >= res.priceRange.minValue * 0.75) {
          minValue = Math.min(minValue, p);
          maxValue = Math.max(maxValue, p);
        }
      }
      return { ...res, priceRange: { minValue, maxValue } };
    };

    guideSeries.current = api.addSeries(LineSeries, {
      color: theme.tone.good,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    guideSeries.current.setData(guide.map((g) => ({ time: g.key as Time, value: g.value })));

    if (style === "candles") {
      const s = api.addSeries(CandlestickSeries, {
        upColor: theme.tone.good,
        downColor: theme.tone.critical,
        wickUpColor: theme.tone.good,
        wickDownColor: theme.tone.critical,
        borderVisible: false,
        priceLineColor: theme.series,
        autoscaleInfoProvider,
      });
      s.setData(candles.map((c) => ({ time: c.key as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
      main.current = s;
    } else {
      const s = api.addSeries(AreaSeries, {
        lineColor: theme.series,
        lineWidth: 2,
        topColor: theme.seriesFill,
        bottomColor: theme.seriesClear,
        priceLineColor: theme.series,
        autoscaleInfoProvider,
      });
      s.setData(candles.map((c) => ({ time: c.key as Time, value: c.close })));
      main.current = s;
    }
    if (keep && applied.current) api.timeScale().setVisibleLogicalRange(keep);
  }, [candles, guide, style, scheme]);

  // Price levels.
  useEffect(() => {
    const s = main.current;
    if (!s || !box.current) return;
    const theme = readTheme(box.current);
    for (const l of priceLines.current) s.removePriceLine(l);
    priceLines.current = levels.map((l) =>
      s.createPriceLine({
        price: l.price,
        color: theme.tone[l.tone],
        lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        lineVisible: l.line,
        axisLabelVisible: true,
        title: l.title,
      }),
    );
    fitLevels.current = levels.filter((l) => l.line).map((l) => l.price);
  }, [levels, candles, style, scheme]);

  // Markers; the focused one is drawn larger.
  useEffect(() => {
    const s = main.current;
    if (!s || !box.current) return;
    const theme = readTheme(box.current);
    const list: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.key as Time,
      id: m.id,
      position: m.position,
      shape: m.shape,
      color: theme.tone[m.tone],
      text: m.text,
      size: m.id === focus ? 2 : 1,
    }));
    if (markerApi.current) markerApi.current.setMarkers(list);
    else markerApi.current = createSeriesMarkers(s, list);
  }, [markers, focus, candles, style, scheme]);

  // The chosen range, when it changes.
  useEffect(() => {
    const api = chart.current;
    if (!api || !candles.length) return;
    const k = `${visible.from}|${visible.to}|${candles.length}`;
    if (applied.current === k) return;
    applied.current = k;
    api.timeScale().setVisibleRange({ from: visible.from as Time, to: visible.to as Time });
  }, [visible, candles]);

  // Bring a focused marker into view, keeping the zoom.
  useEffect(() => {
    const api = chart.current;
    const m = markers.find((x) => x.id === focus);
    if (!api || !m) return;
    const i = candles.findIndex((c) => c.key === m.key);
    const range = api.timeScale().getVisibleLogicalRange();
    if (i < 0 || !range) return;
    if (i >= range.from && i <= range.to) return;
    const half = (range.to - range.from) / 2;
    api.timeScale().setVisibleLogicalRange({ from: i - half, to: i + half });
  }, [focus, markers, candles]);

  return <div ref={box} className={styles.chart} role="img" aria-label={label} />;
}
