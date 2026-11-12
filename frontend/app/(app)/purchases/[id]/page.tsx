import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { PurchaseDetailView } from "./purchase-detail-view";
import { PURCHASE_WRITE_ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "Purchase details" };

export const instant = false;

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const purchaseId = Number(id);

  return (
    <RequireRole roles={PURCHASE_WRITE_ROLES}>
      <PurchaseDetailView purchaseId={purchaseId} />
    </RequireRole>
  );
}
