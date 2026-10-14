import type { Metadata } from "next";
import { Suspense } from "react";
import { PortfolioDetail } from "@/features/portfolio/components/PortfolioDetail";

export const metadata: Metadata = { title: "Portfolio · stocks-rank" };

export default function PortfolioPage({ params }: PageProps<"/portfolios/[id]">) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}

// The portfolio itself is in the browser; the server only passes the id along.
async function Detail({ params }: { params: PageProps<"/portfolios/[id]">["params"] }) {
  const { id } = await params;
  return <PortfolioDetail id={decodeURIComponent(id)} />;
}
