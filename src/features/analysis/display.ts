// Small formatting helpers for showing an analysis.

/** Only plain web links get rendered as links: never a javascript: or data: URL. */
export function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-opus-5": "Claude Opus 5",
  "claude-opus-4-8": "Claude Opus 4.8",
};

export const modelLabel = (id: string) => MODEL_NAMES[id] ?? id;

export const shortDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
