"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * A timestamp in the viewer's time zone. The server doesn't know it, so the
 * first render shows UTC (labelled) and the browser swaps in local time.
 */
export function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const opts = options ?? { dateStyle: "medium", timeStyle: "short" };
  const text = hydrated
    ? new Date(iso).toLocaleString("en-US", opts)
    : `${new Date(iso).toLocaleString("en-US", { ...opts, timeZone: "UTC" })} UTC`;
  return <time dateTime={iso}>{text}</time>;
}
