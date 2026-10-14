"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Skeleton } from "@/ui/Skeleton";
import { formatDollars, type Portfolio } from "../model";
import { usePortfolios } from "../store";
import { AllocationBar } from "./AllocationBar";
import page from "./Page.module.css";
import styles from "./PortfoliosView.module.css";

/** The Portfolios tab: every saved portfolio, newest first. */
export function PortfoliosView() {
  const router = useRouter();
  const list = usePortfolios();
  const build = () => router.push("/portfolios/new");

  if (list === null) {
    return (
      <div className={page.view} aria-busy="true" aria-label="Loading your portfolios">
        <Skeleton style={{ width: "10rem", height: "2.2rem", marginBottom: "1.25rem" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "14px" }} />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className={page.view}>
        <div className={`${page.empty} reveal`}>
          <span className={page.emptyIcon}>
            <Icon name="pie" size={34} />
          </span>
          <h1>No portfolios yet</h1>
          <p>Turn your watchlist into a plan for investing every month. Claude can pick the stocks and propose the split.</p>
          <Button variant="primary" icon="plus" onClick={build}>
            Build a Portfolio
          </Button>
        </div>
      </div>
    );
  }

  const monthly = list.reduce((sum, p) => sum + p.monthly, 0);
  return (
    <div className={page.view}>
      <div className={`${page.stack} reveal`}>
        <header className={page.nav}>
          <div className={page.titleRow}>
            <h1>Portfolios</h1>
            <div className={page.toolbar}>
              <Button variant="tinted" size="sm" icon="plus" iconOnly aria-label="Build a portfolio" onClick={build} />
            </div>
          </div>
          <p className={page.subtitle}>
            {list.length} {list.length === 1 ? "portfolio" : "portfolios"} · {formatDollars(monthly)} a month in all
          </p>
        </header>
        <ul className={styles.list} style={{ "--i": 1 } as React.CSSProperties}>
          {list.map((p) => (
            <li key={p.id}>
              <Row p={p} />
            </li>
          ))}
        </ul>
        <p className={page.footnote}>Saved on this device. Open one to see this month&rsquo;s buys or to edit it.</p>
      </div>
    </div>
  );
}

function Row({ p }: { p: Portfolio }) {
  const top = p.holdings
    .filter((h) => h.weight > 0)
    .slice(0, 4)
    .map((h) => h.symbol);
  const more = p.holdings.filter((h) => h.weight > 0).length - top.length;
  return (
    <Link href={`/portfolios/${p.id}`} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.name}>{p.name}</span>
        <span className={styles.meta}>
          <strong>{formatDollars(p.monthly)}</strong>/mo{p.starting > 0 && <> · {formatDollars(p.starting)} start</>} ·{" "}
          {p.holdings.length} {p.holdings.length === 1 ? "stock" : "stocks"}
        </span>
        <AllocationBar holdings={p.holdings} className={styles.bar} />
        <span className={styles.symbols}>
          {top.join(" · ")}
          {more > 0 && ` +${more}`}
        </span>
      </span>
      <Icon name="chevronRight" size={16} className={styles.chevron} />
    </Link>
  );
}
