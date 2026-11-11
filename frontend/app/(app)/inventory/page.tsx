import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Inventory" };

export const instant = false;

export default function InventoryPage() {
  return (
    <PhasePlaceholder
      phase="F3"
      title="Inventory"
      description="Inspect every batch, spot expiring stock and follow the movement history behind each quantity."
      icon={Boxes}
    />
  );
}
