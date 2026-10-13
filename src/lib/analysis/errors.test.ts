import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnalysisError } from "./claude";
import { describeAnalysisError, isKeyRejected } from "./errors";

const headers = new Headers();
const body = (message: string) => ({ type: "error", error: { type: "invalid_request_error", message } });

describe("describeAnalysisError", () => {
  it("passes our own analysis errors through", () => {
    expect(describeAnalysisError(new AnalysisError("Claude declined to analyze X."))).toBe("Claude declined to analyze X.");
  });

  it("names a bad API key", () => {
    const err = new Anthropic.AuthenticationError(401, body("invalid x-api-key"), "401", headers);
    expect(describeAnalysisError(err)).toMatch(/rejected this API key/);
    expect(isKeyRejected(err)).toBe(true);
  });

  it("surfaces the API's reason for a bad request, such as web search being disabled", () => {
    const err = new Anthropic.BadRequestError(400, body("Web search is not enabled for your organization."), "400", headers);
    expect(describeAnalysisError(err)).toBe(
      "The Anthropic API refused the request: Web search is not enabled for your organization.",
    );
  });

  it("explains rate limits and timeouts", () => {
    expect(describeAnalysisError(new Anthropic.RateLimitError(429, body("slow down"), "429", headers))).toMatch(
      /rate-limiting/,
    );
    expect(describeAnalysisError(new Anthropic.APIConnectionTimeoutError())).toMatch(/too long/);
    expect(isKeyRejected(new Anthropic.RateLimitError(429, body("slow down"), "429", headers))).toBe(false);
  });

  it("covers malformed answers and anything else", () => {
    const zodErr = z.object({ a: z.string() }).safeParse({}).error;
    expect(describeAnalysisError(zodErr)).toMatch(/expected format/);
    expect(describeAnalysisError(new Error("boom"))).toMatch(/Something went wrong/);
  });
});
