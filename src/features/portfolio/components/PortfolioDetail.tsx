"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useWatchlist } from "@/features/watchlist/store";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Menu } from "@/ui/Menu";
import { ActionSheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { Toast } from "@/ui/Toast";
import type { Plan } from "../model";
import { deletePortfolio, savePortfolio, usePortfolios } from "../store";
import { PlanEditor } from "./PlanEditor";
import page from "./Page.module.css";

/** Keys each toast so a new one restarts its timer. */
let toastSeq = 0;

/** One saved portfolio: this month's buys, and every part of the plan, editable and saved on demand. */
export function PortfolioDetail({ id }: { id: string }) {
  const router = useRouter();
  const list = usePortfolios();
  const watchlist = useWatchlist();
  const [edits, setEdits] = useState<{ id: string; plan: Plan } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const addable = useMemo(() => watchlist?.map((e) => e.symbol) ?? [], [watchlist]);

  if (list === null) {
    return (
      <div className={page.view} aria-busy="true" aria-label="Loading the portfolio">
        <Skeleton style={{ width: "12rem", height: "2.2rem", marginBottom: "1.25rem" }} />
        <Skeleton style={{ height: "18rem", borderRadius: "14px" }} />
      </div>
    );
  }
  const saved = list.find((p) => p.id === id);
  if (!saved) {
    return (
      <div className={page.view}>
        <div className={`${page.empty} reveal`}>
          <span className={page.emptyIcon}>
            <Icon name="pie" size={34} />
          </span>
          <h1>Portfolio not found</h1>
          <p>It may have been deleted, or saved on another device. Portfolios stay in the browser that made them.</p>
          <Button variant="primary" onClick={() => router.push("/portfolios")}>
            All Portfolios
          </Button>
        </div>
      </div>
    );
  }

  const dirty = edits !== null && edits.id === id;
  const plan = dirty ? edits.plan : saved;
  const save = () => {
    if (!dirty) return;
    savePortfolio(edits.plan, id);
    setEdits(null);
    setToast({ id: ++toastSeq, text: "Saved" });
  };

  return (
    <div className={page.view}>
      <div className={`${page.stack} reveal`}>
        <header className={page.nav}>
          <Link href="/portfolios" className={page.back}>
            <Icon name="chevronRight" size={18} />
            Portfolios
          </Link>
          {/* The name is edited in place below, so the heading is for assistive tech only. */}
          <h1 className="visually-hidden">{saved.name}</h1>
          <div className={page.titleRow}>
            <p className={page.subtitle}>
              {dirty ? "Unsaved changes" : `Saved ${new Date(saved.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`}
            </p>
            <div className={page.toolbar}>
              <Menu
                label="Portfolio options"
                icon="more"
                variant="tinted"
                size="sm"
                sections={[
                  {
                    items: [
                      {
                        id: "duplicate",
                        label: "Duplicate",
                        icon: "plus",
                        onSelect: () => {
                          const copy = savePortfolio({ ...plan, name: `${plan.name} copy`.slice(0, 80) });
                          router.push(`/portfolios/${copy.id}`);
                        },
                      },
                    ],
                  },
                  { items: [{ id: "delete", label: "Delete Portfolio", icon: "trash", destructive: true, onSelect: () => setConfirmDelete(true) }] },
                ]}
              />
            </div>
          </div>
        </header>

        <PlanEditor plan={plan} onChange={(next) => setEdits({ id, plan: next })} addable={addable} />
        <p className={page.footnote}>
          A starting point for your own decisions, not investment advice. Prices and scores are delayed and can be wrong.
        </p>

        {dirty && (
          <footer className={page.actionBar}>
            <Button variant="ghost" onClick={() => setEdits(null)}>
              Discard
            </Button>
            <span className={page.actionHint}>Unsaved changes</span>
            <Button variant="primary" icon="check" disabled={plan.holdings.length === 0} onClick={save}>
              Save
            </Button>
          </footer>
        )}
      </div>

      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${saved.name}”?`}
        message="It will be removed from this device."
        actions={[
          {
            label: "Delete Portfolio",
            destructive: true,
            onSelect: () => {
              deletePortfolio(id);
              router.push("/portfolios");
            },
          },
        ]}
      />
      {toast && (
        <Toast key={toast.id} icon="check" onDismiss={() => setToast(null)} duration={2500}>
          {toast.text}
        </Toast>
      )}
    </div>
  );
}
