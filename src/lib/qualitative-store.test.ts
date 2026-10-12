import { describe, expect, it } from "vitest";
import { parseQualitative } from "./qualitative-store";

describe("parseQualitative", () => {
  it("keeps only known metrics with 0/5/10 scores", () => {
    expect(parseQualitative('{"moat":10,"ceo":5,"talent":0,"culture":7,"bogus":10,"secularTrend":"10"}')).toEqual({
      moat: 10,
      ceo: 5,
      talent: 0,
    });
  });

  it("tolerates missing or corrupt data", () => {
    expect(parseQualitative(null)).toEqual({});
    expect(parseQualitative("not json")).toEqual({});
    expect(parseQualitative("[1,2]")).toEqual({});
    expect(parseQualitative("null")).toEqual({});
  });
});
