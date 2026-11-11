import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Reports" };

export const instant = false;

export default function ReportsPage() {
  return (
    <PhasePlaceholder
      phase="F6"
      title="Reports"
      description="Review sales, stock valuation, expiry exposure and the ledger reconciliation for a date range."
      icon={ChartColumn}
    />
  );
}
