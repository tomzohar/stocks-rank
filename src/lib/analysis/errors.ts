import Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";
import { AnalysisError } from "./claude";

/** The API's own error message, e.g. "web search is not enabled for this organization". */
function apiMessage(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  const msg = body?.error?.message;
  return typeof msg === "string" && msg ? msg : err.message;
}

/** Turns a failed analysis into one sentence the page can show. Most specific first. */
export function describeAnalysisError(err: unknown): string {
  if (err instanceof AnalysisError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in the deployment's environment variables.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return `The API key isn't allowed to do this: ${apiMessage(err)}`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The Anthropic API is rate-limiting this key. Reload in a minute.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The Anthropic API refused the request: ${apiMessage(err)}`;
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return "Claude took too long to answer. Reload to try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the Anthropic API. Reload to try again.";
  }
  if (err instanceof Anthropic.APIError) {
    return `The Anthropic API returned an error (${err.status ?? "no status"}). Reload to try again.`;
  }
  if (err instanceof ZodError) {
    return "Claude's answer didn't match the expected format. Reload to try again.";
  }
  return "Something went wrong while Claude was scoring. Reload to try again.";
}
