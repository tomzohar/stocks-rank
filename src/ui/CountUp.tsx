"use client";

import { useTween } from "./motion";

/** A whole number that counts up to `value` (and glides on change). */
export function CountUp({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [shown] = useTween([value], { duration });
  return <>{Math.round(shown)}</>;
}
