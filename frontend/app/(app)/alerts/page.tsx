import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Alerts" };

export const instant = false;

export default function AlertsPage() {
  return (
    <PhasePlaceholder
      phase="F5"
      title="Alerts"
      description="See low-stock medicines, batches approaching expiry and stock that can no longer be sold."
      icon={TriangleAlert}
    />
  );
}
