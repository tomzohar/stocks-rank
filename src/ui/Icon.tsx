// A small inline icon set (24×24, stroke-based), so no icon font or extra request.
const PATHS = {
  check: "M5 12.5l4.2 4.2L19 7",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  x: "M6 6l12 12M18 6L6 18",
  info: "M12 11v6m0-9.5v.01M12 21a9 9 0 110-18 9 9 0 010 18z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  refresh: "M20 11a8 8 0 00-14.7-4.4L4 8m0-5v5h5M4 13a8 8 0 0014.7 4.4L20 16m0 5v-5h-5",
  offline: "M3 3l18 18M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 015.2-2.7m4.6.3A10 10 0 0119 12.9M2 9.3a15 15 0 014.4-2.8m4-.9A15 15 0 0122 9.3M12 20h.01",
  download: "M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14",
  key: "M15.5 7.5a3 3 0 11-6 0 3 3 0 016 0zM12.5 10.4L4 19v2h3v-2h2v-2h2l1.6-1.6",
  external: "M14 4h6v6m0-6L11 13M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  arrowUp: "M12 19V5m0 0l-6 6m6-6l6 6",
  arrowDown: "M12 5v14m0 0l-6-6m6 6l6-6",
  search: "M20 20l-4.3-4.3M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
