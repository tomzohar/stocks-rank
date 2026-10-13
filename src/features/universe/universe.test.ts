import { describe, expect, it } from "vitest";
import { STOCKS, findStock, searchStocks, type Stock } from "./universe";

const s = (symbol: string, name: string, indexes: Stock["indexes"] = ["SP500"]): Stock => ({
  symbol,
  name,
  sector: null,
  indexes,
});

describe("the bundled universe", () => {
  it("covers the S&P 500 and the Nasdaq-100 without duplicates", () => {
    const symbols = STOCKS.map((x) => x.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(STOCKS.filter((x) => x.indexes.includes("SP500")).length).toBeGreaterThanOrEqual(500);
    expect(STOCKS.filter((x) => x.indexes.includes("NDX")).length).toBeGreaterThanOrEqual(100);
  });

  it("uses Yahoo symbols for share classes", () => {
    expect(findStock("BRK.B")?.symbol).toBe("BRK-B");
    expect(findStock("brk-b")?.name).toMatch(/Berkshire/);
  });

  it("includes Nasdaq-100 members outside the S&P 500", () => {
    expect(findStock("ASML")?.indexes).toEqual(["NDX"]);
  });
});

describe("searchStocks", () => {
  const stocks = [
    s("AAPL", "Apple Inc.", ["SP500", "NDX"]),
    s("AMAT", "Applied Materials", ["SP500", "NDX"]),
    s("APP", "AppLovin", ["SP500", "NDX"]),
    s("MSFT", "Microsoft", ["SP500", "NDX"]),
    s("PNW", "Pinnacle West Capital"),
    s("WAP", "Something Apple"),
  ];
  const symbols = (q: string, opts = {}) => searchStocks(q, { stocks, ...opts }).map((x) => x.symbol);

  it("ranks exact symbol, symbol prefix, name prefix, then word match", () => {
    expect(symbols("app")).toEqual(["APP", "AAPL", "AMAT", "WAP"]);
  });

  it("matches inside names", () => {
    expect(symbols("soft")).toEqual(["MSFT"]);
  });

  it("filters by index", () => {
    expect(symbols("", { index: "NDX" })).toEqual(["AAPL", "AMAT", "APP", "MSFT"]);
    expect(symbols("p", { index: "SP500", limit: 2 })).toEqual(["PNW", "AAPL"]);
  });
});
