import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Sales" };

export const instant = false;

export default function SalesPage() {
  return (
    <PhasePlaceholder
      phase="F4"
      title="Sales"
      description="Build a sale at the counter, let FEFO choose the batches, and print a clear invoice."
      icon={ReceiptText}
    />
  );
}
