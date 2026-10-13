"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Values `t` (0–1) of the way from `from` to `to`; missing starting values count as 0. */
export function interpolate(from: readonly number[], to: readonly number[], t: number): number[] {
  return to.map((v, i) => (from[i] ?? 0) + (v - (from[i] ?? 0)) * t);
}

/**
 * Animates a list of numbers towards `target`: from 0 on first render, then
 * from wherever they are when the target changes. Returns `target` as-is
 * when the viewer prefers reduced motion.
 */
export function useTween(target: readonly number[], { duration = 900, delay = 0 } = {}): readonly number[] {
  const reduced = usePrefersReducedMotion();
  const [values, setValues] = useState<number[]>(() => target.map(() => 0));
  const current = useRef<number[]>(values);
  const key = target.join(",");

  useEffect(() => {
    if (reduced) return;
    const to = key === "" ? [] : key.split(",").map(Number);
    const from = current.current;
    let start: number | null = null;
    let frame = requestAnimationFrame(function step(now) {
      start ??= now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      const next = interpolate(from, to, easeOutCubic(t));
      current.current = next;
      setValues(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [key, reduced, duration, delay]);

  return reduced ? target : values;
}
