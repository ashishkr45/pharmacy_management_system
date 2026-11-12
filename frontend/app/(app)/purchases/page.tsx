import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { PurchasesView } from "./purchases-view";
import { PURCHASE_WRITE_ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "Purchases" };

export const instant = false;

export default function PurchasesPage() {
  return (
    <RequireRole roles={PURCHASE_WRITE_ROLES}>
      <PurchasesView />
    </RequireRole>
  );
}
