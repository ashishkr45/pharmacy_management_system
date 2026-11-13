import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SaleForm } from "@/components/sales/sale-form";
import { RequireRole } from "@/components/auth/require-role";
import { buttonVariants } from "@/components/ui/button";
import { SALE_WRITE_ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "New sale" };

export const instant = false;

export default function NewSalePage() {
  return (
    <RequireRole roles={SALE_WRITE_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title="New sale"
          description="Add medicines and quantities only. The server allocates batches by FEFO and calculates prices, tax, totals and the invoice number."
          actions={
            <Link
              href="/sales"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to sales
            </Link>
          }
        />
        <SaleForm />
      </div>
    </RequireRole>
  );
}
