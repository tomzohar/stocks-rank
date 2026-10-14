import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaudeLogView } from "@/features/claude-log/components/ClaudeLogView";

export const metadata: Metadata = { title: "Claude Log · stocks-rank" };

// The log lives in the browser, so the page is a shell that fills in on load.
export default function ClaudeLogPage() {
  return (
    <Suspense>
      <ClaudeLogView />
    </Suspense>
  );
}
