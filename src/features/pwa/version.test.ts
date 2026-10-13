import { describe, expect, it } from "vitest";
import { isNewBuild, parseVersion } from "./version";

describe("version check", () => {
  it("reads the build id and ignores anything else", () => {
    expect(parseVersion({ build: "abc123" })).toBe("abc123");
    expect(parseVersion({ build: "" })).toBeNull();
    expect(parseVersion({ nope: true })).toBeNull();
    expect(parseVersion("<html>login</html>")).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });

  it("flags a new build only when the live one is known and different", () => {
    expect(isNewBuild("a", "b")).toBe(true);
    expect(isNewBuild("a", "a")).toBe(false);
    expect(isNewBuild("a", null)).toBe(false);
  });
});
