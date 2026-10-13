import { describe, expect, it } from "vitest";
import { hostname, isWebUrl, modelLabel } from "./display";

describe("analysis display helpers", () => {
  it("only accepts http(s) links", () => {
    expect(isWebUrl("https://example.com/a")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("data:text/html,hi")).toBe(false);
    expect(isWebUrl("not a url")).toBe(false);
  });

  it("names hosts and models", () => {
    expect(hostname("https://www.reuters.com/x")).toBe("reuters.com");
    expect(modelLabel("claude-opus-5-5")).toBe("Claude Opus 5.5");
    expect(modelLabel("something-else")).toBe("something-else");
  });
});
