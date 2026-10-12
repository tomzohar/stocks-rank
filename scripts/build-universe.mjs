// Regenerates src/data/universe.json: the union of the S&P 500 and the Nasdaq-100.
//
//   npm run universe
//
// Sources (both public, no API key):
//   - S&P 500: github.com/datasets/s-and-p-500-companies (constituents.csv)
//   - Nasdaq-100: github.com/jmccarrell/n100tickers (yearly YAML: Jan 1 members + dated changes)
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SP500_CSV =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";
const N100_YAML = (year) =>
  `https://raw.githubusercontent.com/jmccarrell/n100tickers/master/src/nasdaq_100_ticker_history/n100-ticker-changes-${year}.yaml`;

// Nasdaq-100 members that are not in the S&P 500, so the CSV has no name for them.
const NON_SP500_NAMES = {
  ALAB: "Astera Labs",
  ALNY: "Alnylam Pharmaceuticals",
  ARM: "Arm Holdings",
  ASML: "ASML Holding",
  CCEP: "Coca-Cola Europacific Partners",
  CRWV: "CoreWeave",
  FER: "Ferrovial",
  MELI: "MercadoLibre",
  MSTR: "Strategy",
  NBIS: "Nebius Group",
  PDD: "PDD Holdings",
  RKLB: "Rocket Lab",
  SHOP: "Shopify",
  SPCX: "Space Exploration Technologies (SpaceX)",
  TRI: "Thomson Reuters",
};

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/)) {
    const cells = [];
    let cur = "";
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// The n100tickers YAML is a fixed, simple shape; a line-based reader avoids a YAML dependency.
function applyN100Year(yaml) {
  const members = new Set();
  let section = null;
  let op = null;
  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("tickers_on_Jan_1:")) section = "base";
    else if (line.startsWith("changes:")) section = "changes";
    else if (line === "union:") op = "add";
    else if (line === "difference:") op = "remove";
    else if (line.startsWith("- ")) {
      const t = line.slice(2).trim();
      if (section === "base") members.add(t);
      else if (op === "add") members.add(t);
      else if (op === "remove") members.delete(t);
    }
  }
  return members;
}

async function currentN100() {
  const year = new Date().getUTCFullYear();
  try {
    return applyN100Year(await get(N100_YAML(year)));
  } catch {
    // Early January, before the new year's file exists.
    return applyN100Year(await get(N100_YAML(year - 1)));
  }
}

// Yahoo uses "-" for share classes (BRK.B -> BRK-B).
const toYahoo = (symbol) => symbol.replace(/\./g, "-");

const sp500 = parseCsv(await get(SP500_CSV));
const n100 = await currentN100();

const bySymbol = new Map();
for (const row of sp500) {
  const symbol = toYahoo(row.Symbol);
  bySymbol.set(symbol, {
    symbol,
    name: row.Security,
    sector: row["GICS Sector"] || null,
    indexes: ["SP500"],
  });
}
for (const raw of n100) {
  const symbol = toYahoo(raw);
  const existing = bySymbol.get(symbol);
  if (existing) existing.indexes.push("NDX");
  else
    bySymbol.set(symbol, {
      symbol,
      name: NON_SP500_NAMES[raw] ?? raw,
      sector: null,
      indexes: ["NDX"],
    });
}

const unnamed = [...n100].filter((t) => !bySymbol.get(toYahoo(t)).name || bySymbol.get(toYahoo(t)).name === t);
if (unnamed.length) console.warn(`No company name for: ${unnamed.join(", ")} (add to NON_SP500_NAMES)`);

const universe = {
  generatedAt: new Date().toISOString().slice(0, 10),
  stocks: [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
};
const out = fileURLToPath(new URL("../src/data/universe.json", import.meta.url));
// One stock per line keeps diffs readable when index membership changes.
const body = universe.stocks.map((s) => "    " + JSON.stringify(s)).join(",\n");
await writeFile(out, `{\n  "generatedAt": "${universe.generatedAt}",\n  "stocks": [\n${body}\n  ]\n}\n`);
console.log(`Wrote ${universe.stocks.length} stocks (${sp500.length} S&P 500, ${n100.size} Nasdaq-100) to ${out}`);
