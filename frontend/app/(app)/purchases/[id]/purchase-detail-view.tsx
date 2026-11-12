"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Purchase } from "@/lib/api/types";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";

function rowCost(quantity: number, costPrice: string): string {
  const value = Number(costPrice);
  return Number.isFinite(value) ? formatMoney(String(quantity * value)) : "-";
}

export function PurchaseDetailView({ purchaseId }: { purchaseId: number }) {
  const validId = Number.isInteger(purchaseId) && purchaseId > 0;
  const item = useApiItem<Purchase>(
    validId ? `/purchases/${purchaseId}` : null,
  );

  if (!validId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Purchase details"
          actions={
            <Link
              href="/purchases"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to purchases
            </Link>
          }
        />
        <div className="rounded-lg border bg-card">
          <ErrorState message="This purchase link is not valid." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.data ? `Purchase ${item.data.supplierInvoiceNo}` : "Purchase details"}
        description="Immutable purchase record, its stock lines and the current stock in each receiving batch."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/purchases"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to purchases
            </Link>
            <Link href="/purchases/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Receive another
            </Link>
          </div>
        }
      />

      {item.isLoading ? (
        <LoadingState label="Loading purchase..." />
      ) : item.error ? (
        <div className="rounded-lg border bg-card">
          <ErrorState message={item.error} onRetry={item.reload} />
        </div>
      ) : item.data ? (
        <>
          <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Supplier
              </p>
              <p className="font-medium">{item.data.supplier.name}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Supplier invoice
              </p>
              <p className="font-mono text-xs font-medium">
                {item.data.supplierInvoiceNo}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Purchase date
              </p>
              <p>{formatDate(item.data.purchaseDate)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Recorded
              </p>
              <p>{formatDateTime(item.data.createdAt)}</p>
              <p className="text-xs text-muted-foreground">
                by {item.data.createdBy.name}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Total cost
              </p>
              <p className="font-heading text-base font-semibold tabular-nums">
                {formatMoney(item.data.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Lines
              </p>
              <p className="tabular-nums">{item.data.items.length}</p>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-sm font-medium">Received items</h2>
              <p className="text-xs text-muted-foreground">
                The batch stock column is the current quantity, which can differ
                from the quantity received on this invoice.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <caption className="sr-only">
                  Items received on purchase {item.data.supplierInvoiceNo}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost price</TableHead>
                    <TableHead className="text-right">Sale price</TableHead>
                    <TableHead className="text-right">Line cost</TableHead>
                    <TableHead className="text-right">Batch stock now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.data.items.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="font-medium">{line.medicine.name}</p>
                        <p className="font-mono text-[0.625rem] text-muted-foreground">
                          {line.medicine.sku}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.batch.batchNo}
                      </TableCell>
                      <TableCell>{formatDate(line.expiryDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(line.costPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(line.salePrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rowCost(line.quantity, line.costPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {line.batch.quantityOnHand}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
