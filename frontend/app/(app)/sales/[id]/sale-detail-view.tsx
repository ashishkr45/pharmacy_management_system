"use client";

import Link from "next/link";
import { Printer, ReceiptText } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Sale } from "@/lib/api/types";
import { formatDateTime, formatDate, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";

function taxRateLabel(rate: string): string {
  const value = Number(rate);
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2,
      }).format(value)}%`
    : `${rate}%`;
}

export function SaleDetailView({ saleId }: { saleId: number }) {
  const validId = Number.isInteger(saleId) && saleId > 0;
  const item = useApiItem<Sale>(validId ? `/sales/${saleId}` : null);
  const totalUnits =
    item.data?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  if (!validId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Sale details"
          actions={
            <Link
              href="/sales"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to sales
            </Link>
          }
        />
        <div className="rounded-lg border bg-card">
          <ErrorState message="This sale link is not valid." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.data ? item.data.invoiceNo : "Sale details"}
        description="Completed invoice with the server's FEFO batch allocation, prices and tax."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sales"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to sales
            </Link>
            <Link
              href={`/sales/${saleId}/invoice`}
              className={buttonVariants()}
            >
              <Printer aria-hidden="true" />
              Print invoice
            </Link>
          </div>
        }
      />

      {item.isLoading ? (
        <LoadingState label="Loading sale..." />
      ) : item.error ? (
        <div className="rounded-lg border bg-card">
          <ErrorState message={item.error} onRetry={item.reload} />
        </div>
      ) : item.data ? (
        <>
          <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Customer
              </p>
              <p className="font-medium">
                {item.data.customerName ?? "Walk-in customer"}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.data.customerPhone ?? "No phone recorded"}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Sold
              </p>
              <p>{formatDateTime(item.data.createdAt)}</p>
              <p className="text-xs text-muted-foreground">
                by {item.data.createdBy.name}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Payment
              </p>
              <p>{PAYMENT_METHOD_LABELS[item.data.paymentMethod]}</p>
              <p className="text-xs text-muted-foreground">
                Label only; no payment processed
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <SaleStatusBadge status={item.data.status} />
              <p className="text-xs text-muted-foreground">
                {totalUnits} unit{totalUnits === 1 ? "" : "s"} across{" "}
                {item.data.items.length} batch line
                {item.data.items.length === 1 ? "" : "s"}
              </p>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <section className="min-w-0 space-y-3">
              <div>
                <h2 className="font-heading text-sm font-medium">
                  FEFO allocation
                </h2>
                <p className="text-xs/relaxed text-muted-foreground">
                  One row per batch allocation. An early-expiry batch can be
                  followed by another batch for the same medicine when the
                  requested quantity does not fit in one batch.
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <caption className="sr-only">
                    FEFO batch lines for sale {item.data.invoiceNo}
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">
                        Line total (incl. tax)
                      </TableHead>
                      <TableHead className="text-right">Returned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.data.items.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium">{line.medicine.name}</p>
                          <p className="font-mono text-[0.625rem] text-muted-foreground">
                            {line.medicine.sku} · {line.medicine.unit}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.batch.batchNo}
                        </TableCell>
                        <TableCell>{formatDate(line.batch.expiryDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(line.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <p>{formatMoney(line.taxAmount)}</p>
                          <p className="text-[0.625rem] text-muted-foreground">
                            {taxRateLabel(line.taxRate)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(line.lineTotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.returnedQuantity > 0 ? (
                            <Badge variant="outline">
                              {line.returnedQuantity} of {line.quantity}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <aside className="h-fit space-y-4 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <ReceiptText
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="font-heading text-sm font-medium">
                  Invoice totals
                </h2>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney(item.data.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">
                    {formatMoney(item.data.taxTotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-2">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-heading text-base font-semibold tabular-nums">
                    {formatMoney(item.data.total)}
                  </dd>
                </div>
              </dl>

              <p className="text-[0.6875rem]/relaxed text-muted-foreground">
                Tax is added on top of the line subtotals. Money and totals are
                the values stored by the API at the time of sale.
              </p>

              <Link
                href={`/sales/${saleId}/invoice`}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                <Printer aria-hidden="true" />
                Open printable invoice
              </Link>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
