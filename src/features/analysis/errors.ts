import Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";
import { AnalysisError } from "./analysis-error";

/** The API's own error message, e.g. "web search is not enabled for this organization". */
function apiMessage(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  const msg = body?.error?.message;
  return typeof msg === "string" && msg ? msg : err.message;
}

/**
 * Turns a failed Claude run into one sentence the page can show. Most specific
 * first. `activity` names the job ("scoring"); `retry` is how to try again.
 */
export function describeAnalysisError(
  err: unknown,
  { activity = "scoring", retry = "Reload to try again." }: { activity?: string; retry?: string } = {},
): string {
  if (err instanceof AnalysisError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic rejected this API key. Check it, or enter a different one.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return `The API key isn't allowed to do this: ${apiMessage(err)}`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return `The Anthropic API is rate-limiting this key. Wait a minute, then ${retry.charAt(0).toLowerCase()}${retry.slice(1)}`;
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The Anthropic API refused the request: ${apiMessage(err)}`;
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return `Claude took too long to answer. ${retry}`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return `Couldn't reach the Anthropic API. ${retry}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `The Anthropic API returned an error (${err.status ?? "no status"}). ${retry}`;
  }
  if (err instanceof ZodError) {
    return `Claude's answer didn't match the expected format. ${retry}`;
  }
  return `Something went wrong while Claude was ${activity}. ${retry}`;
}

/** True when the key itself is the problem, so the page should ask for another. */
export function isKeyRejected(err: unknown): boolean {
  return err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError;
}
