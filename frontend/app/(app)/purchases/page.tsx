import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Purchases" };

export const instant = false;

export default function PurchasesPage() {
  return (
    <RequireRole roles={["ADMIN", "INVENTORY_MANAGER"]}>
      <PhasePlaceholder
        phase="F3"
        title="Purchases"
        description="Receive stock into batches, record supplier invoices and write the matching ledger entries."
        icon={ShoppingCart}
      />
    </RequireRole>
  );
}
