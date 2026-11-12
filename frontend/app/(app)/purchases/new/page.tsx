import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { NewPurchaseView } from "./new-purchase-view";
import { PURCHASE_WRITE_ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "Receive purchase" };

export const instant = false;

export default function NewPurchasePage() {
  return (
    <RequireRole roles={PURCHASE_WRITE_ROLES}>
      <NewPurchaseView />
    </RequireRole>
  );
}
