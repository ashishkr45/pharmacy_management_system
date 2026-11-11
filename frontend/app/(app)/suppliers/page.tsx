import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Suppliers" };

export const instant = false;

export default function SuppliersPage() {
  return (
    <PhasePlaceholder
      phase="F2"
      title="Suppliers"
      description="Keep the supplier list current so purchases can be recorded against the right vendor."
      icon={Truck}
    />
  );
}
